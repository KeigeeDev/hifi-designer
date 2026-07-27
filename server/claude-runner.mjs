import { spawn } from "node:child_process";
import path from "node:path";

import { buildDesignPrompt, DESIGN_OUTPUT_SCHEMA, prepareDesignRuntime } from "./design-runtime.mjs";
import { assertClaudeSubscription } from "./provider-auth.mjs";
import { buildSanitizedClaudeEnvironment, safeError } from "./security.mjs";

function normalizeSummary(result) {
  if (result?.structured_output && typeof result.structured_output === "object") return result.structured_output;
  if (typeof result?.result === "string") {
    try {
      return JSON.parse(result.result);
    } catch {
      return { summary: safeError(result.result), files: [], nextStep: "Review the output." };
    }
  }
  return { summary: "Generation completed.", files: [], nextStep: "Review the output." };
}

function safeClaudeProgress(message) {
  if (message.type === "system" && message.subtype === "init") {
    return { message: "Claude session started.", sessionId: message.session_id };
  }
  if (message.type === "system" && message.subtype === "api_retry") {
    return { message: `Claude is retrying a temporary provider error (attempt ${message.attempt || 1}).` };
  }
  if (message.type === "assistant") {
    const blocks = Array.isArray(message.message?.content) ? message.message.content : [];
    const tools = blocks.filter((block) => block.type === "tool_use").map((block) => block.name);
    if (tools.some((name) => ["Write", "Edit"].includes(name))) return { message: "Claude updated the staged HTML output." };
    if (tools.includes("Read")) return { message: "Claude is reading the brief and design guidance." };
  }
  if (message.type === "result" && message.subtype === "success") return { message: "Claude generation completed." };
  return null;
}

export class ClaudeRunner {
  constructor({ repoRoot, projectService, spawnFn = spawn, subscriptionCheck = assertClaudeSubscription }) {
    this.repoRoot = repoRoot;
    this.projectService = projectService;
    this.provider = "claude";
    this.spawnFn = spawnFn;
    this.subscriptionCheck = subscriptionCheck;
  }

  async run({ project, action, selection = "", feedback = "", signal, onEvent = () => {} }) {
    await this.subscriptionCheck();
    const { runtimeDir, imagePaths } = await prepareDesignRuntime({ repoRoot: this.repoRoot, projectService: this.projectService, project });
    const referencePaths = imagePaths.map((entry) => path.relative(runtimeDir, entry).replaceAll("\\", "/"));
    const prompt = buildDesignPrompt(project, action, selection, feedback, referencePaths);
    const args = [
      "-p",
      prompt,
      "--model",
      project.agent.model,
      "--output-format",
      "stream-json",
      "--verbose",
      "--json-schema",
      JSON.stringify(DESIGN_OUTPUT_SCHEMA),
      "--permission-mode",
      "acceptEdits",
      "--tools",
      "Read,Write,Edit",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--setting-sources",
      "",
      "--no-chrome",
    ];
    if (project.agent.model === "default") {
      args.splice(args.indexOf("--model"), 2);
    }
    if (project.workflow.sessionId) args.push("--resume", project.workflow.sessionId);

    const child = this.spawnFn("claude", args, {
      cwd: runtimeDir,
      env: buildSanitizedClaudeEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdoutBuffer = "";
    let stderr = "";
    let sessionId = project.workflow.sessionId;
    let finalResult = null;
    let streamError = null;
    let lineTasks = Promise.resolve();

    const handleLine = async (line) => {
      if (!line.trim()) return;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (message.session_id) sessionId = message.session_id;
      if (message.type === "result") {
        finalResult = message;
        if (message.is_error || message.subtype !== "success") streamError = message.result || message.error || "Claude generation failed.";
      }
      const progress = safeClaudeProgress(message);
      if (progress) await onEvent({ ...progress, sessionId: progress.sessionId || sessionId });
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";
      for (const line of lines) lineTasks = lineTasks.then(() => handleLine(line));
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-16 * 1024); });

    const abort = () => child.kill();
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code));
    }).finally(() => signal?.removeEventListener("abort", abort));
    if (stdoutBuffer.trim()) lineTasks = lineTasks.then(() => handleLine(stdoutBuffer));
    await lineTasks;
    if (signal?.aborted) throw new Error("Claude generation cancelled.");
    if (exitCode !== 0 || streamError) throw new Error(safeError(streamError || stderr || `Claude exited with code ${exitCode}.`));
    if (!finalResult || !sessionId) throw new Error("Claude did not return a complete session result.");

    return {
      runtimeDir,
      sessionId,
      usage: finalResult.usage || null,
      summary: normalizeSummary(finalResult),
    };
  }
}
