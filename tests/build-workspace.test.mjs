import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildCatalog,
  buildWorkspace,
  renderWorkspace,
  serializeCatalog,
  titleCase,
} from "../scripts/build-workspace.mjs";

async function withTempDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hifi-workspace-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("titleCase derives readable labels from folders and filenames", () => {
  assert.equal(titleCase("shopify-developer_portfolio"), "Shopify Developer Portfolio");
  assert.equal(titleCase("sample_hifi_design.html"), "Sample Hifi Design");
  assert.equal(titleCase("café-index"), "Café Index");
});

test("an absent projects directory produces an empty catalog", async () => {
  await withTempDirectory(async (directory) => {
    const catalog = await buildCatalog({
      projectsDir: path.join(directory, "missing"),
      generatedAt: new Date("2026-07-25T08:00:00.000Z"),
    });
    assert.equal(catalog.projectCount, 0);
    assert.equal(catalog.pageCount, 0);
    assert.deepEqual(catalog.projects, []);
  });
});

test("scanner includes direct HTML pages and ignores nested, hidden, empty, and workspace folders", async () => {
  await withTempDirectory(async (projectsDir) => {
    const alphaDir = path.join(projectsDir, "alpha-project");
    const betaDir = path.join(projectsDir, "beta-project");
    await Promise.all([
      mkdir(path.join(alphaDir, "nested"), { recursive: true }),
      mkdir(betaDir, { recursive: true }),
      mkdir(path.join(projectsDir, ".hidden-project"), { recursive: true }),
      mkdir(path.join(projectsDir, "empty-project"), { recursive: true }),
      mkdir(path.join(projectsDir, "hifi-designer-workspace"), { recursive: true }),
    ]);

    const alphaHome = path.join(alphaDir, "home_page.html");
    const alphaAbout = path.join(alphaDir, "about.html");
    const betaPage = path.join(betaDir, "café-index.HTML");
    await Promise.all([
      writeFile(alphaHome, "<!doctype html><title>Alpha Home</title>", "utf8"),
      writeFile(alphaAbout, "<!doctype html><title>Alpha About</title>", "utf8"),
      writeFile(path.join(alphaDir, "nested", "ignored.html"), "<title>Nested</title>", "utf8"),
      writeFile(betaPage, "<!doctype html><title>Café</title><p>Crème brûlée</p>", "utf8"),
      writeFile(path.join(projectsDir, ".hidden-project", "hidden.html"), "<title>Hidden</title>", "utf8"),
      writeFile(path.join(projectsDir, "hifi-designer-workspace", "workspace.html"), "<title>Workspace</title>", "utf8"),
      writeFile(path.join(projectsDir, "empty-project", "notes.txt"), "No HTML", "utf8"),
    ]);

    const oldTime = new Date("2026-07-20T08:00:00.000Z");
    const newTime = new Date("2026-07-25T08:00:00.000Z");
    await Promise.all([
      utimes(alphaHome, oldTime, oldTime),
      utimes(alphaAbout, oldTime, oldTime),
      utimes(betaPage, newTime, newTime),
    ]);

    const catalog = await buildCatalog({
      projectsDir,
      generatedAt: new Date("2026-07-25T09:00:00.000Z"),
    });

    assert.equal(catalog.projectCount, 2);
    assert.equal(catalog.pageCount, 3);
    assert.deepEqual(catalog.projects.map((project) => project.slug), [
      "beta-project",
      "alpha-project",
    ]);
    assert.deepEqual(catalog.projects[1].pages.map((page) => page.slug), [
      "about",
      "home_page",
    ]);
    assert.equal(catalog.projects[1].pages[1].name, "Home Page");
    assert.equal(
      Buffer.from(catalog.projects[0].pages[0].content, "base64").toString("utf8"),
      "<!doctype html><title>Café</title><p>Crème brûlée</p>",
    );
  });
});

test("catalog serialization is safe inside a script and template marker is strict", () => {
  const serialized = serializeCatalog({ projects: [{ name: "</script><p>unsafe</p>" }] });
  assert.ok(!serialized.includes("</script>"));
  assert.ok(serialized.includes("\\u003c/script>"));
  assert.equal(
    renderWorkspace("const catalog = __HIFI_CATALOG__;", { projectCount: 0 }),
    'const catalog = {"projectCount":0};',
  );
  assert.throws(
    () => renderWorkspace("No marker", {}),
    /exactly once/,
  );
});

test("buildWorkspace writes a generated standalone HTML file", async () => {
  await withTempDirectory(async (directory) => {
    const projectsDir = path.join(directory, "projects");
    const projectDir = path.join(projectsDir, "one-project");
    const templatePath = path.join(directory, "template.html");
    const outputPath = path.join(directory, "workspace.html");
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, "index.html"), "<!doctype html><h1>One</h1>", "utf8");
    await writeFile(
      templatePath,
      "<!doctype html><script>const CATALOG = __HIFI_CATALOG__;</script>",
      "utf8",
    );

    const result = await buildWorkspace({
      projectsDir,
      templatePath,
      outputPath,
      generatedAt: new Date("2026-07-25T10:00:00.000Z"),
    });
    const output = await readFile(outputPath, "utf8");
    assert.equal(result.catalog.projectCount, 1);
    assert.equal(result.catalog.pageCount, 1);
    assert.match(output, /"slug":"one-project"/);
    assert.doesNotMatch(output, /__HIFI_CATALOG__/);
  });
});

test("root workspace keeps design tweaks out of the project library", async () => {
  const template = await readFile(
    new URL("../workspace.template.html", import.meta.url),
    "utf8",
  );
  const generated = await readFile(
    new URL("../hifi-designer-workspace.html", import.meta.url),
    "utf8",
  );

  for (const source of [template, generated]) {
    assert.match(
      source,
      /id="tweaksDock"[^>]*data-tweaks-bar[^>]*hidden/,
    );
    assert.match(source, /\$\("#tweaksDock"\)\.hidden = false;/);
    assert.match(source, /\$\("#tweaksDock"\)\.hidden = true;/);
    assert.doesNotMatch(
      source,
      /applyTweaksToRoot\(document\.documentElement\)/,
    );
  }
});
