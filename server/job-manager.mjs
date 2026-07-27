import { randomUUID } from "node:crypto";

import { publishOutput, validateOutput } from "./output-validator.mjs";
import { HttpError, safeError } from "./security.mjs";

const COMPLETE_STAGE = {
  directions: "directions-ready",
  refinements: "refinements-ready",
  revision: "revision-ready",
  final: "finalized",
};

function publicJob(job) {
  return {
    id: job.id,
    projectSlug: job.projectSlug,
    provider: job.provider,
    model: job.model,
    action: job.action,
    state: job.state,
    message: job.message,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
    result: job.result,
    events: job.events,
  };
}

export class JobManager {
  constructor({ projectService, runners, codexRunner, buildWorkspace }) {
    this.projectService = projectService;
    this.runners = runners || { codex: codexRunner };
    this.buildWorkspace = buildWorkspace;
    this.jobs = new Map();
    this.queue = [];
    this.activeJob = null;
    this.listeners = new Map();
  }

  async enqueue({ projectSlug, action, selection = "", feedback = "" }) {
    if ([...this.jobs.values()].some((job) => job.projectSlug === projectSlug && ["queued", "running", "validating", "publishing"].includes(job.state))) {
      throw new HttpError(409, "This project already has an active generation job.", "project_busy");
    }
    const project = await this.projectService.read(projectSlug);
    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      projectSlug,
      provider: project.agent.provider,
      model: project.agent.model,
      action,
      selection,
      feedback,
      state: "queued",
      message: "Waiting for the local agent.",
      createdAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      result: null,
      events: [],
      abortController: new AbortController(),
    };
    this.jobs.set(job.id, job);
    try {
      await this.projectService.updateWorkflow(projectSlug, { activeJobId: job.id });
    } catch (error) {
      this.jobs.delete(job.id);
      throw error;
    }
    this.queue.push(job);
    this.emit(job, "queued", job.message);
    void this.drain();
    return publicJob(job);
  }

  get(id) {
    const job = this.jobs.get(id);
    return job ? publicJob(job) : null;
  }

  listActive() {
    return [...this.jobs.values()]
      .filter((job) => ["queued", "running", "validating", "publishing"].includes(job.state))
      .map(publicJob);
  }

  async cancel(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (job.state === "queued") {
      this.queue = this.queue.filter((candidate) => candidate.id !== id);
      job.state = "cancelled";
      job.message = "Generation cancelled before it started.";
      job.completedAt = new Date().toISOString();
      await this.projectService.updateWorkflow(job.projectSlug, {
        stage: "interrupted",
        activeJobId: null,
        lastJob: { id: job.id, action: job.action, state: "cancelled", completedAt: job.completedAt },
      });
      this.emit(job, "cancelled", job.message);
    } else if (job === this.activeJob && job.state === "running") {
      job.message = "Cancelling the active generation…";
      job.abortController.abort();
      this.emit(job, "cancelling", job.message);
    }
    return publicJob(job);
  }

  subscribe(id, listener) {
    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    this.listeners.get(id).add(listener);
    return () => {
      const listeners = this.listeners.get(id);
      listeners?.delete(listener);
      if (!listeners?.size) this.listeners.delete(id);
    };
  }

  emit(job, type, message, extra = {}) {
    const event = { id: job.events.length + 1, type, message, at: new Date().toISOString(), ...extra };
    job.events.push(event);
    if (job.events.length > 100) job.events.shift();
    for (const listener of this.listeners.get(job.id) || []) listener(event, publicJob(job));
  }

  async drain() {
    if (this.activeJob) return;
    const job = this.queue.shift();
    if (!job) return;
    this.activeJob = job;
    job.state = "running";
    job.startedAt = new Date().toISOString();
    job.message = "The agent is generating the design.";
    this.emit(job, "running", job.message);

    try {
      let project = await this.projectService.updateWorkflow(job.projectSlug, {
        stage: `${job.action}-running`,
        activeJobId: job.id,
      });
      const runner = this.runners[project.agent.provider];
      if (!runner) throw new HttpError(400, "The selected agent provider is unavailable.", "provider_unavailable");
      const result = await runner.run({
        project,
        action: job.action,
        selection: job.selection,
        feedback: job.feedback,
        signal: job.abortController.signal,
        onEvent: async (progress) => {
          job.message = progress.message;
          this.emit(job, "progress", progress.message);
          if (progress.sessionId && progress.sessionId !== project.workflow.sessionId) {
            project = await this.projectService.updateWorkflow(job.projectSlug, { sessionId: progress.sessionId });
          }
        },
      });

      job.state = "validating";
      job.message = "Validating the standalone HTML and credential boundaries.";
      this.emit(job, "validating", job.message);
      const validated = await validateOutput(result.runtimeDir, job.action);

      job.state = "publishing";
      job.message = "Publishing the validated design and refreshing the workspace.";
      this.emit(job, "publishing", job.message);
      const projectDir = this.projectService.projectDir(job.projectSlug);
      await publishOutput(projectDir, validated);
      await this.buildWorkspace();

      const completedAt = new Date().toISOString();
      const publishedResult = {
        filename: validated.filename,
        bytes: validated.bytes,
        summary: result.summary.summary,
        nextStep: result.summary.nextStep,
      };
      await this.projectService.updateWorkflow(job.projectSlug, {
        stage: COMPLETE_STAGE[job.action],
        sessionId: result.sessionId || project.workflow.sessionId,
        activeJobId: null,
        lastJob: { id: job.id, action: job.action, state: "completed", completedAt },
        ...(job.action === "refinements" ? { selectedDirection: job.selection } : {}),
        ...(job.action === "revision" ? { selectedRefinement: job.selection } : {}),
      });
      job.state = "completed";
      job.message = "Design ready for review.";
      job.completedAt = completedAt;
      job.result = publishedResult;
      this.emit(job, "completed", job.message, { result: job.result });
    } catch (error) {
      const cancelled = job.abortController.signal.aborted;
      job.state = cancelled ? "cancelled" : "failed";
      job.message = cancelled ? "Generation cancelled." : "Generation failed.";
      job.error = cancelled ? null : safeError(error);
      job.completedAt = new Date().toISOString();
      await this.projectService.updateWorkflow(job.projectSlug, {
        stage: cancelled ? "interrupted" : `${job.action}-failed`,
        activeJobId: null,
        lastJob: { id: job.id, action: job.action, state: job.state, completedAt: job.completedAt },
      }).catch(() => {});
      this.emit(job, job.state, job.message, job.error ? { error: job.error } : {});
    } finally {
      this.activeJob = null;
      void this.drain();
    }
  }
}
