import { Codex } from "@openai/codex-sdk";

import { buildDesignPrompt, DESIGN_OUTPUT_SCHEMA, prepareDesignRuntime } from "./design-runtime.mjs";
import { buildSanitizedCodexEnvironment, safeError } from "./security.mjs";

function safeProgress(event) {
  if (event.type === "thread.started") return { message: "Codex thread started.", sessionId: event.thread_id };
  if (event.type === "turn.started") return { message: "Codex is reading the brief and design guidance." };
  if (event.type === "turn.completed") return { message: "Codex generation completed.", usage: event.usage };
  if (event.type === "turn.failed") return { message: "Codex generation failed." };
  if (event.type === "item.completed") {
    if (event.item.type === "file_change") return { message: "Codex updated the staged HTML output." };
    if (event.item.type === "command_execution") return { message: "Codex completed a local validation step." };
    if (event.item.type === "web_search") return { message: "Codex reviewed a visual reference." };
    if (event.item.type === "agent_message") return { message: "Codex prepared the generation summary." };
  }
  return null;
}

export class CodexRunner {
  constructor({ repoRoot, projectService }) {
    this.repoRoot = repoRoot;
    this.projectService = projectService;
    this.provider = "codex";
    this.codex = new Codex({ env: buildSanitizedCodexEnvironment() });
  }

  async run({ project, action, selection = "", feedback = "", signal, onEvent = () => {} }) {
    const { runtimeDir, imagePaths } = await prepareDesignRuntime({ repoRoot: this.repoRoot, projectService: this.projectService, project });
    const options = {
      model: project.agent.model,
      workingDirectory: runtimeDir,
      skipGitRepoCheck: true,
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      modelReasoningEffort: "high",
      networkAccessEnabled: true,
      webSearchMode: "live",
    };
    const thread = project.workflow.sessionId
      ? this.codex.resumeThread(project.workflow.sessionId, options)
      : this.codex.startThread(options);
    const inputs = [
      { type: "text", text: buildDesignPrompt(project, action, selection, feedback) },
      ...imagePaths.map((imagePath) => ({ type: "local_image", path: imagePath })),
    ];
    const { events } = await thread.runStreamed(inputs, { outputSchema: DESIGN_OUTPUT_SCHEMA, signal });
    let finalResponse = "";
    let sessionId = project.workflow.sessionId;
    let usage = null;
    for await (const event of events) {
      if (event.type === "thread.started") sessionId = event.thread_id;
      if (event.type === "turn.completed") usage = event.usage;
      if (event.type === "item.completed" && event.item.type === "agent_message") finalResponse = event.item.text;
      const progress = safeProgress(event);
      if (progress) await onEvent({ ...progress, sessionId: progress.sessionId || sessionId });
      if (event.type === "turn.failed") throw new Error(event.error?.message || "Codex turn failed.");
      if (event.type === "error") throw new Error(event.message || "Codex stream failed.");
    }

    let summary = { summary: "Generation completed.", files: [], nextStep: "Review the output." };
    if (finalResponse) {
      try {
        summary = JSON.parse(finalResponse);
      } catch {
        summary.summary = safeError(finalResponse);
      }
    }
    return { runtimeDir, sessionId: sessionId || thread.id, usage, summary };
  }
}
