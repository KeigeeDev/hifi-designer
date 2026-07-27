import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ProjectService, slugifyProjectName, validateBrief } from "../server/project-service.mjs";

async function withTempDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hifi-project-service-"));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

const validBrief = {
  name: "Northstar Launch",
  aesthetic: "Editorial Swiss grid with a restrained technical character.",
  references: "Stripe Press and Linear's information density.",
  intent: "Explain a technical analytics product and earn qualified demos.",
  audience: "Technical founders and data platform leads.",
  primaryAction: "Book a technical demo",
  guardrails: "No gradients, glass panels, generic cards, or vague copy.",
};

test("project names become safe deterministic slugs", () => {
  assert.equal(slugifyProjectName("  Café / North Star  "), "cafe-north-star");
  assert.equal(validateBrief(validBrief).slug, "northstar-launch");
  assert.deepEqual(validateBrief(validBrief).agent, { provider: "codex", model: "gpt-5.6-sol", authMode: "subscription" });
});

test("project service stores metadata and reference images without exposing session ids", async () => {
  await withTempDirectory(async (directory) => {
    const service = new ProjectService({
      projectsDir: path.join(directory, "projects"),
      runtimeDir: path.join(directory, "runtime"),
    });
    const created = await service.create({
      ...validBrief,
      referenceImages: [{ name: "screen.png", type: "image/png", data: Buffer.from("png-bytes").toString("base64") }],
    });
    assert.equal(created.slug, "northstar-launch");
    assert.equal(created.workflow.stage, "brief-ready");
    assert.equal(created.references[0].name, "reference-01.png");
    assert.deepEqual(created.agent, { provider: "codex", model: "gpt-5.6-sol", authMode: "subscription" });
    assert.equal("threadId" in created.workflow, false);
    assert.equal("sessionId" in created.workflow, false);

    const stored = JSON.parse(await readFile(path.join(directory, "projects", "northstar-launch", ".hifi-project.json"), "utf8"));
    assert.equal(stored.referenceImages[0].relativePath, "references/reference-01.png");
    assert.equal(stored.workflow.sessionId, null);
    assert.equal("threadId" in stored.workflow, false);
  });
});

test("provider and model selection is subscription-only and allowlisted", () => {
  assert.deepEqual(validateBrief({ ...validBrief, provider: "claude", model: "sonnet" }).agent, {
    provider: "claude",
    model: "sonnet",
    authMode: "subscription",
  });
  assert.throws(
    () => validateBrief({ ...validBrief, provider: "claude", model: "claude-unlisted" }),
    error => error.code === "invalid_model",
  );
});

test("brief validation rejects credential-like values", () => {
  assert.throws(
    () => validateBrief({ ...validBrief, references: `OPENAI_API_KEY=${"x".repeat(32)}` }),
    error => error.code === "secret_detected",
  );
});

test("existing legacy project directories cannot be claimed by a new project", async () => {
  await withTempDirectory(async (directory) => {
    const projectsDir = path.join(directory, "projects");
    const service = new ProjectService({ projectsDir, runtimeDir: path.join(directory, "runtime") });
    await service.create(validBrief);
    await assert.rejects(() => service.create(validBrief), error => error.code === "project_exists");
  });
});
