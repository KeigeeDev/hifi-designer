import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { validateProviderSelection } from "./provider-config.mjs";
import { HttpError, containsSecret } from "./security.mjs";

const METADATA_FILE = ".hifi-project.json";
const IMAGE_TYPES = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;

function cleanText(value, label, { min = 1, max = 4000 } = {}) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (text.length < min) {
    throw new HttpError(400, `${label} is required.`, "invalid_brief", { field: label });
  }
  if (text.length > max) {
    throw new HttpError(400, `${label} is too long.`, "invalid_brief", { field: label });
  }
  if (containsSecret(text)) {
    throw new HttpError(400, `${label} appears to contain a credential. Remove it before continuing.`, "secret_detected", { field: label });
  }
  return text;
}

export function slugifyProjectName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function validateBrief(input = {}) {
  const name = cleanText(input.name, "Project name", { min: 2, max: 100 });
  const slug = slugifyProjectName(name);
  if (!slug) throw new HttpError(400, "Project name must contain letters or numbers.", "invalid_project_name");

  return {
    name,
    slug,
    agent: validateProviderSelection(input.provider, input.model),
    aesthetic: cleanText(input.aesthetic, "Aesthetic direction", { min: 8, max: 2500 }),
    references: cleanText(input.references, "References", { min: 2, max: 5000 }),
    intent: cleanText(input.intent, "Intent", { min: 8, max: 2500 }),
    audience: cleanText(input.audience, "Audience", { min: 3, max: 1500 }),
    primaryAction: cleanText(input.primaryAction, "Primary action", { min: 2, max: 1000 }),
    guardrails: cleanText(input.guardrails, "Guardrails", { min: 2, max: 4000 }),
    referenceImages: Array.isArray(input.referenceImages) ? input.referenceImages : [],
  };
}

function publicProject(metadata) {
  return {
    managed: true,
    version: metadata.version,
    name: metadata.name,
    slug: metadata.slug,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    agent: metadata.agent,
    brief: metadata.brief,
    references: metadata.referenceImages.map(({ name, type, bytes }) => ({ name, type, bytes })),
    workflow: {
      stage: metadata.workflow.stage,
      activeJobId: metadata.workflow.activeJobId,
      lastJob: metadata.workflow.lastJob,
      selectedDirection: metadata.workflow.selectedDirection,
      selectedRefinement: metadata.workflow.selectedRefinement,
    },
  };
}

function normalizeMetadata(metadata) {
  const agent = metadata.agent || validateProviderSelection("codex", "gpt-5.6-sol");
  const { threadId, ...workflow } = metadata.workflow || {};
  return {
    ...metadata,
    version: Math.max(Number(metadata.version) || 1, 2),
    agent,
    workflow: {
      ...workflow,
      sessionId: workflow.sessionId || threadId || null,
      activeJobId: workflow.activeJobId || null,
    },
  };
}

export class ProjectService {
  constructor({ projectsDir, runtimeDir }) {
    this.projectsDir = path.resolve(projectsDir);
    this.runtimeDir = path.resolve(runtimeDir);
  }

  projectDir(slug) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
      throw new HttpError(400, "Invalid project identifier.", "invalid_project_slug");
    }
    const resolved = path.resolve(this.projectsDir, slug);
    if (path.dirname(resolved) !== this.projectsDir) {
      throw new HttpError(400, "Invalid project path.", "invalid_project_path");
    }
    return resolved;
  }

  projectRuntimeDir(slug) {
    const projectDir = this.projectDir(slug);
    void projectDir;
    const resolved = path.resolve(this.runtimeDir, slug);
    if (path.dirname(resolved) !== this.runtimeDir) {
      throw new HttpError(400, "Invalid runtime path.", "invalid_runtime_path");
    }
    return resolved;
  }

  async exists(slug) {
    try {
      await stat(this.projectDir(slug));
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  }

  async create(input) {
    const brief = validateBrief(input);
    const projectDir = this.projectDir(brief.slug);
    if (await this.exists(brief.slug)) {
      throw new HttpError(409, "A project with this name already exists.", "project_exists", { slug: brief.slug });
    }

    const preparedImages = this.prepareReferenceImages(brief.referenceImages);
    await mkdir(this.projectsDir, { recursive: true });
    try {
      await mkdir(projectDir);
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new HttpError(409, "A project with this name already exists.", "project_exists", { slug: brief.slug });
      }
      throw error;
    }
    await mkdir(path.join(projectDir, "references"));
    const referenceImages = await this.saveReferenceImages(projectDir, preparedImages);
    const now = new Date().toISOString();
    const metadata = {
      version: 2,
      name: brief.name,
      slug: brief.slug,
      createdAt: now,
      updatedAt: now,
      agent: brief.agent,
      brief: {
        aesthetic: brief.aesthetic,
        references: brief.references,
        intent: brief.intent,
        audience: brief.audience,
        primaryAction: brief.primaryAction,
        guardrails: brief.guardrails,
      },
      referenceImages,
      workflow: {
        stage: "brief-ready",
        sessionId: null,
        activeJobId: null,
        lastJob: null,
        selectedDirection: null,
        selectedRefinement: null,
      },
    };
    await this.writeMetadata(metadata);
    return publicProject(metadata);
  }

  prepareReferenceImages(images) {
    if (images.length > MAX_IMAGES) {
      throw new HttpError(400, `Upload no more than ${MAX_IMAGES} reference images.`, "too_many_images");
    }
    return images.map((candidate, index) => {
      const image = candidate || {};
      const type = String(image.type || "").toLowerCase();
      const extension = IMAGE_TYPES.get(type);
      if (!extension) throw new HttpError(400, "Reference images must be PNG, JPEG, or WebP.", "invalid_image_type");
      const encoded = String(image.data || "").replace(/^data:[^;]+;base64,/, "");
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
        throw new HttpError(400, "A reference image is not valid base64 data.", "invalid_image_data");
      }
      const buffer = Buffer.from(encoded, "base64");
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
        throw new HttpError(400, "Each reference image must be between 1 byte and 5 MB.", "invalid_image_size");
      }
      const filename = `reference-${String(index + 1).padStart(2, "0")}${extension}`;
      const relativePath = path.join("references", filename);
      return { name: filename, type, bytes: buffer.length, relativePath: relativePath.replaceAll("\\", "/"), buffer };
    });
  }

  async saveReferenceImages(projectDir, images) {
    const saved = [];
    for (const image of images) {
      await writeFile(path.join(projectDir, image.relativePath), image.buffer, { flag: "wx" });
      const { buffer, ...metadata } = image;
      void buffer;
      saved.push(metadata);
    }
    return saved;
  }

  async read(slug) {
    const file = path.join(this.projectDir(slug), METADATA_FILE);
    try {
      return normalizeMetadata(JSON.parse(await readFile(file, "utf8")));
    } catch (error) {
      if (error?.code === "ENOENT") throw new HttpError(404, "Project not found.", "project_not_found");
      throw error;
    }
  }

  async readPublic(slug) {
    return publicProject(await this.read(slug));
  }

  async updateWorkflow(slug, patch) {
    const metadata = await this.read(slug);
    metadata.workflow = { ...metadata.workflow, ...patch };
    metadata.updatedAt = new Date().toISOString();
    await this.writeMetadata(metadata);
    return metadata;
  }

  async writeMetadata(metadata) {
    const projectDir = this.projectDir(metadata.slug);
    await mkdir(projectDir, { recursive: true });
    const target = path.join(projectDir, METADATA_FILE);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  }

  public(metadata) {
    return publicProject(metadata);
  }
}
