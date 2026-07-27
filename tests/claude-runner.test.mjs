import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ClaudeRunner } from "../server/claude-runner.mjs";
import { ProjectService } from "../server/project-service.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brief = {
  name: "Claude Runner Test",
  provider: "claude",
  model: "sonnet",
  aesthetic: "Restrained editorial typography with a precise technical grid.",
  references: "Use the written direction without external references.",
  intent: "Present a focused local design workflow.",
  audience: "Independent product designers.",
  primaryAction: "Start a design project",
  guardrails: "No gradients, glass, blobs, or generic feature cards.",
};

test("Claude runner verifies subscription and launches the selected model with restricted tools", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hifi-claude-runner-"));
  try {
    const projectService = new ProjectService({
      projectsDir: path.join(directory, "projects"),
      runtimeDir: path.join(directory, "runtime"),
    });
    const created = await projectService.create(brief);
    const project = await projectService.read(created.slug);
    let subscriptionChecks = 0;
    let launch;
    const spawnFn = (command, args, options) => {
      launch = { command, args, options };
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => child.emit("exit", null);
      setImmediate(async () => {
        await writeFile(
          path.join(options.cwd, "directions.html"),
          '<!doctype html><html><head><style>:root{--accent:#25f;--font-scale:1;--space-scale:1;--radius:8px}</style></head><body><h1>Directions</h1></body></html>',
          "utf8",
        );
        child.stdout.write(`${JSON.stringify({ type: "system", subtype: "init", session_id: "claude-session-test" })}\n`);
        child.stdout.write(`${JSON.stringify({
          type: "result",
          subtype: "success",
          session_id: "claude-session-test",
          structured_output: { summary: "Ready.", files: [{ path: "directions.html", purpose: "Five directions" }], nextStep: "Review." },
        })}\n`);
        child.stdout.end();
        child.stderr.end();
        child.emit("exit", 0);
      });
      return child;
    };
    const runner = new ClaudeRunner({
      repoRoot,
      projectService,
      spawnFn,
      subscriptionCheck: async () => { subscriptionChecks += 1; },
    });
    const progress = [];
    const result = await runner.run({ project, action: "directions", onEvent: event => progress.push(event) });

    assert.equal(subscriptionChecks, 1);
    assert.equal(launch.command, "claude");
    assert.deepEqual(launch.args.slice(launch.args.indexOf("--model"), launch.args.indexOf("--model") + 2), ["--model", "sonnet"]);
    assert.deepEqual(launch.args.slice(launch.args.indexOf("--tools"), launch.args.indexOf("--tools") + 2), ["--tools", "Read,Write,Edit"]);
    assert.equal(launch.args[launch.args.indexOf("--mcp-config") + 1], '{"mcpServers":{}}');
    assert.equal(launch.args.includes("--dangerously-skip-permissions"), false);
    assert.equal(launch.options.windowsHide, true);
    assert.equal(result.sessionId, "claude-session-test");
    assert.equal(result.summary.summary, "Ready.");
    assert.equal(progress.some(event => event.sessionId === "claude-session-test"), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Claude runner stops before launch when subscription verification fails", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hifi-claude-subscription-"));
  try {
    const projectService = new ProjectService({ projectsDir: path.join(directory, "projects"), runtimeDir: path.join(directory, "runtime") });
    const created = await projectService.create({ ...brief, name: "Claude Subscription Test" });
    const project = await projectService.read(created.slug);
    let launched = false;
    const runner = new ClaudeRunner({
      repoRoot,
      projectService,
      spawnFn: () => { launched = true; },
      subscriptionCheck: async () => { throw new Error("Claude subscription required."); },
    });
    await assert.rejects(() => runner.run({ project, action: "directions" }), /subscription required/i);
    assert.equal(launched, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
