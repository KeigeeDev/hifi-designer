import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ProjectService } from "../server/project-service.mjs";
import { createWorkspaceApplication } from "../server/workspace-server.mjs";

const brief = {
  name: "Server Route Test",
  aesthetic: "Editorial archive with a strong serif display face and precise mono metadata.",
  references: "No references; use the described archive direction.",
  intent: "Introduce a focused local design review tool.",
  audience: "Independent interface designers.",
  primaryAction: "Create a local project",
  guardrails: "No gradients, glass panels, floating blobs, or generic card grids.",
};

const html = '<!doctype html><html><head><style>:root{--accent:#25f;--font-scale:1;--space-scale:1;--radius:8px}body{margin:0;padding:40px;font-family:serif}</style></head><body><h1>Five directions</h1><p>Complete project-specific content prepared for visual comparison and review.</p></body></html>';

async function waitForCompletion(jobs, id) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = jobs.get(id);
    if (["completed", "failed", "cancelled"].includes(job.state)) return job;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for server job.");
}

test("project API creates a local project and returns only safe job state", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hifi-server-test-"));
  const projectsDir = path.join(directory, "projects");
  const runtimeDir = path.join(directory, "runtime");
  const projectService = new ProjectService({ projectsDir, runtimeDir });
  const codexRunner = {
    model: "test-model",
    async run({ project, onEvent }) {
      const workingDirectory = projectService.projectRuntimeDir(project.slug);
      await mkdir(workingDirectory, { recursive: true });
      await onEvent({ message: "Agent session started.", sessionId: "safe-session-id" });
      await writeFile(path.join(workingDirectory, "directions.html"), html, "utf8");
      return { runtimeDir: workingDirectory, sessionId: "safe-session-id", summary: { summary: "Ready.", nextStep: "Review." } };
    },
  };
  const application = createWorkspaceApplication({
    repoRoot: directory,
    projectsDir,
    runtimeDir,
    port: 0,
    projectService,
    codexRunner,
    providerStatusFn: async provider => ({ connected: provider === "codex", method: provider === "codex" ? "ChatGPT subscription" : null, reason: provider === "codex" ? null : "Not connected." }),
    buildWorkspaceFn: async () => {},
  });
  const server = createServer(application.handle);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const statusResponse = await fetch(`${baseUrl}/api/status`);
    const statusPayload = await statusResponse.json();
    assert.equal(statusResponse.status, 200);
    assert.deepEqual(statusPayload.providers.map(provider => provider.id), ["codex", "claude"]);
    assert.equal(statusPayload.providers[0].connected, true);
    assert.equal(statusPayload.providers[1].connected, false);
    assert.equal(JSON.stringify(statusPayload).includes("email"), false);

    const response = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hifi-Request": "1" },
      body: JSON.stringify(brief),
    });
    assert.equal(response.status, 202);
    const payload = await response.json();
    assert.equal(payload.project.slug, "server-route-test");
    assert.deepEqual(payload.project.agent, { provider: "codex", model: "gpt-5.6-sol", authMode: "subscription" });
    assert.equal("threadId" in payload.project.workflow, false);
    assert.equal("sessionId" in payload.project.workflow, false);
    assert.equal(JSON.stringify(payload).includes("safe-session-id"), false);
    assert.equal((await waitForCompletion(application.jobs, payload.job.id)).state, "completed");

    const projectResponse = await fetch(`${baseUrl}/api/projects/server-route-test`);
    assert.equal(projectResponse.status, 200);
    assert.equal(JSON.stringify(await projectResponse.json()).includes("safe-session-id"), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("mutating routes reject foreign browser origins", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hifi-server-origin-"));
  const projectService = new ProjectService({ projectsDir: path.join(directory, "projects"), runtimeDir: path.join(directory, "runtime") });
  const application = createWorkspaceApplication({
    repoRoot: directory,
    projectsDir: path.join(directory, "projects"),
    runtimeDir: path.join(directory, "runtime"),
    port: 0,
    projectService,
    codexRunner: { model: "test", run: async () => { throw new Error("not called"); } },
    providerStatusFn: async () => ({ connected: true, method: "Test subscription" }),
    buildWorkspaceFn: async () => {},
  });
  const server = createServer(application.handle);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hifi-Request": "1", Origin: "https://malicious.example" },
      body: JSON.stringify(brief),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "invalid_origin");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
