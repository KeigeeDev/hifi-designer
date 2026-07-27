import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { JobManager } from "../server/job-manager.mjs";
import { ProjectService } from "../server/project-service.mjs";

const brief = {
  name: "Queue Test",
  aesthetic: "Sharp editorial grid with a deliberate serif and mono pairing.",
  references: "No references; use the supplied aesthetic as the anchor.",
  intent: "Create a launch page for a local design workflow.",
  audience: "Independent product designers.",
  primaryAction: "Start a design project",
  guardrails: "No gradients, blobs, glass, or generic feature cards.",
};

function validDirections() {
  return '<!doctype html><html><head><style>:root{--accent:#25f;--font-scale:1;--space-scale:1;--radius:8px}body{margin:0;padding:40px;font-family:serif}</style></head><body><h1>Five design directions</h1><p>Distinct editorial design output prepared for review and selection.</p></body></html>';
}

async function waitForJob(manager, id) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = manager.get(id);
    if (["completed", "failed", "cancelled"].includes(job.state)) return job;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for test job.");
}

test("job manager validates, publishes, rebuilds, and persists the provider session", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hifi-job-manager-"));
  try {
    const projectService = new ProjectService({ projectsDir: path.join(directory, "projects"), runtimeDir: path.join(directory, "runtime") });
    const project = await projectService.create(brief);
    let builds = 0;
    const codexRunner = {
      async run({ project: storedProject, onEvent }) {
        const runtimeDir = projectService.projectRuntimeDir(storedProject.slug);
        await mkdir(runtimeDir, { recursive: true });
        await onEvent({ message: "Agent session started.", sessionId: "session-test-1" });
        await writeFile(path.join(runtimeDir, "directions.html"), validDirections(), "utf8");
        return { runtimeDir, sessionId: "session-test-1", summary: { summary: "Five directions ready.", nextStep: "Choose one." } };
      },
    };
    const manager = new JobManager({ projectService, codexRunner, buildWorkspace: async () => { builds += 1; } });
    const queued = await manager.enqueue({ projectSlug: project.slug, action: "directions" });
    const completed = await waitForJob(manager, queued.id);
    assert.equal(completed.state, "completed");
    assert.equal(completed.result.filename, "directions.html");
    assert.equal(completed.provider, "codex");
    assert.equal(completed.model, "gpt-5.6-sol");
    assert.equal(builds, 1);
    const metadata = await projectService.read(project.slug);
    assert.equal(metadata.workflow.stage, "directions-ready");
    assert.equal(metadata.workflow.sessionId, "session-test-1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
