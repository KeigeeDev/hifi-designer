import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_PROJECTS_DIR = path.join(REPO_ROOT, "projects");
const WORKSPACE_SLUG = "hifi-designer-workspace";
const DEFAULT_TEMPLATE_PATH = path.join(REPO_ROOT, "workspace.template.html");
const DEFAULT_OUTPUT_PATH = path.join(REPO_ROOT, "hifi-designer-workspace.html");
const CATALOG_MARKER = "__HIFI_CATALOG__";
const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export function titleCase(value = "") {
  const normalized = String(value)
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toLocaleUpperCase("en") + word.slice(1))
    .join(" ");
}

export async function buildCatalog({
  projectsDir = DEFAULT_PROJECTS_DIR,
  excludedProject = WORKSPACE_SLUG,
  generatedAt = new Date(),
} = {}) {
  let entries = [];
  try {
    entries = await readdir(projectsDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        generatedAt: generatedAt.toISOString(),
        projectCount: 0,
        pageCount: 0,
        projects: [],
      };
    }
    throw error;
  }

  const projectEntries = entries.filter(
    (entry) =>
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      entry.name !== excludedProject,
  );

  const projects = (
    await Promise.all(
      projectEntries.map(async (projectEntry) => {
        const projectDir = path.join(projectsDir, projectEntry.name);
        const pageEntries = (await readdir(projectDir, { withFileTypes: true }))
          .filter(
            (entry) =>
              entry.isFile() &&
              !entry.name.startsWith(".") &&
              path.extname(entry.name).toLowerCase() === ".html",
          )
          .sort((left, right) => collator.compare(left.name, right.name));

        if (!pageEntries.length) return null;

        const pages = await Promise.all(
          pageEntries.map(async (pageEntry) => {
            const pagePath = path.join(projectDir, pageEntry.name);
            const [content, pageStat] = await Promise.all([
              readFile(pagePath),
              stat(pagePath),
            ]);
            const slug = path.basename(pageEntry.name, path.extname(pageEntry.name));
            return {
              slug,
              name: titleCase(slug),
              sourceLabel: pageEntry.name,
              modifiedAt: pageStat.mtime.toISOString(),
              bytes: pageStat.size,
              content: content.toString("base64"),
            };
          }),
        );

        const modifiedAt = pages.reduce(
          (latest, page) =>
            page.modifiedAt > latest ? page.modifiedAt : latest,
          pages[0].modifiedAt,
        );

        return {
          slug: projectEntry.name,
          name: titleCase(projectEntry.name),
          modifiedAt,
          pageCount: pages.length,
          pages,
        };
      }),
    )
  )
    .filter(Boolean)
    .sort(
      (left, right) =>
        right.modifiedAt.localeCompare(left.modifiedAt) ||
        collator.compare(left.name, right.name),
    );

  return {
    generatedAt: generatedAt.toISOString(),
    projectCount: projects.length,
    pageCount: projects.reduce(
      (total, project) => total + project.pages.length,
      0,
    ),
    projects,
  };
}

export function serializeCatalog(catalog) {
  return JSON.stringify(catalog)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function renderWorkspace(template, catalog) {
  const markerCount = template.split(CATALOG_MARKER).length - 1;
  if (markerCount !== 1) {
    throw new Error(
      `Workspace template must contain ${CATALOG_MARKER} exactly once; found ${markerCount}.`,
    );
  }
  return template.replace(CATALOG_MARKER, serializeCatalog(catalog));
}

export async function buildWorkspace({
  projectsDir = DEFAULT_PROJECTS_DIR,
  templatePath = DEFAULT_TEMPLATE_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
  generatedAt = new Date(),
} = {}) {
  const [template, catalog] = await Promise.all([
    readFile(templatePath, "utf8"),
    buildCatalog({ projectsDir, generatedAt }),
  ]);
  const output = renderWorkspace(template, catalog);
  await writeFile(outputPath, output, "utf8");
  return { catalog, outputPath };
}

async function main() {
  const { catalog, outputPath } = await buildWorkspace();
  const relativeOutput = path.relative(REPO_ROOT, outputPath);
  console.log(
    `Built ${relativeOutput} with ${catalog.projectCount} project${
      catalog.projectCount === 1 ? "" : "s"
    } and ${catalog.pageCount} page${catalog.pageCount === 1 ? "" : "s"}.`,
  );
}

const invokedPath = globalThis.process?.argv?.[1]
  ? path.resolve(globalThis.process.argv[1])
  : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    if (globalThis.process) globalThis.process.exitCode = 1;
  });
}
