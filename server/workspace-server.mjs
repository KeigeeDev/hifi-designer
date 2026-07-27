import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildCatalog, buildWorkspace } from "../scripts/build-workspace.mjs";
import { ClaudeRunner } from "./claude-runner.mjs";
import { CodexRunner } from "./codex-runner.mjs";
import { JobManager } from "./job-manager.mjs";
import { outputNameForAction, targetExists } from "./output-validator.mjs";
import { claudeSubscriptionStatus, codexLoginStatus, startProviderLogin } from "./provider-auth.mjs";
import { PROVIDERS, publicProviderDefinition, validateProviderSelection } from "./provider-config.mjs";
import { ProjectService } from "./project-service.mjs";
import {
  HttpError,
  assertLoopbackHost,
  assertSameOrigin,
  containsSecret,
  readJsonBody,
  safeError,
} from "./security.mjs";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SERVER_DIR, "..");
const DEFAULT_PROJECTS_DIR = path.join(REPO_ROOT, "projects");
const DEFAULT_RUNTIME_DIR = path.join(REPO_ROOT, ".hifi-runtime");
const WORKSPACE_FILE = path.join(REPO_ROOT, "hifi-designer-workspace.html");
const TERMINAL_JOB_STATES = new Set(["completed", "failed", "cancelled"]);
const ACTION_STAGES = {
  directions: new Set(["brief-ready", "directions-failed", "interrupted"]),
  refinements: new Set(["directions-ready", "refinements-failed", "interrupted"]),
  revision: new Set(["refinements-ready", "revision-ready", "finalized", "revision-failed", "interrupted"]),
  final: new Set(["refinements-ready", "revision-ready", "finalized", "final-failed", "interrupted"]),
};

function json(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function assertMutationRequest(request, expectedOrigin) {
  assertSameOrigin(request, expectedOrigin);
  if (request.headers["x-hifi-request"] !== "1") {
    throw new HttpError(403, "Missing the local workspace request header.", "invalid_request_header");
  }
}

function cleanRunText(value, label, max = 4000) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (text.length > max) throw new HttpError(400, `${label} is too long.`, "invalid_run_input");
  if (containsSecret(text)) throw new HttpError(400, `${label} appears to contain a credential.`, "secret_detected");
  return text;
}

function parsePort(argv = process.argv.slice(2)) {
  const index = argv.indexOf("--port");
  const raw = index >= 0 ? argv[index + 1] : process.env.HIFI_PORT || "8080";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be an integer between 1 and 65535.");
  }
  return port;
}

function sendSse(response, event) {
  response.write(`id: ${event.id ?? "snapshot"}\n`);
  response.write(`event: ${event.type || "message"}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function createWorkspaceApplication({
  repoRoot = REPO_ROOT,
  projectsDir = DEFAULT_PROJECTS_DIR,
  runtimeDir = DEFAULT_RUNTIME_DIR,
  port = 8080,
  projectService: injectedProjectService,
  codexRunner: injectedCodexRunner,
  claudeRunner: injectedClaudeRunner,
  providerStatusFn: injectedProviderStatus,
  buildWorkspaceFn,
} = {}) {
  const expectedOrigin = `http://127.0.0.1:${port}`;
  const projectService = injectedProjectService || new ProjectService({ projectsDir, runtimeDir });
  const codexRunner = injectedCodexRunner || new CodexRunner({ repoRoot, projectService });
  const claudeRunner = injectedClaudeRunner || new ClaudeRunner({ repoRoot, projectService });
  const runners = { codex: codexRunner, claude: claudeRunner };
  const providerStatus = injectedProviderStatus || (async (provider) => (
    provider === "codex" ? codexLoginStatus() : claudeSubscriptionStatus()
  ));
  const rebuild = buildWorkspaceFn || (() => buildWorkspace({ projectsDir }));
  const jobs = new JobManager({ projectService, runners, buildWorkspace: rebuild });

  async function handle(request, response) {
    try {
      assertLoopbackHost(request);
      const url = new URL(request.url || "/", expectedOrigin);

      if (request.method === "GET" && url.pathname === "/api/status") {
        const [codexStatus, claudeStatus] = await Promise.all([providerStatus("codex"), providerStatus("claude")]);
        const providers = [
          publicProviderDefinition("codex", codexStatus),
          publicProviderDefinition("claude", claudeStatus),
        ];
        return json(response, 200, {
          ok: true,
          localOnly: true,
          providers,
          activeJobs: jobs.listActive(),
        });
      }

      if (request.method === "GET" && url.pathname === "/api/catalog") {
        return json(response, 200, await buildCatalog({ projectsDir }));
      }

      if (request.method === "POST" && url.pathname === "/api/auth/login") {
        assertMutationRequest(request, expectedOrigin);
        return json(response, 202, { ok: true, message: startProviderLogin("codex") });
      }

      const providerLoginMatch = url.pathname.match(/^\/api\/providers\/(codex|claude)\/login$/);
      if (request.method === "POST" && providerLoginMatch) {
        assertMutationRequest(request, expectedOrigin);
        return json(response, 202, { ok: true, message: startProviderLogin(providerLoginMatch[1]) });
      }

      if (request.method === "POST" && url.pathname === "/api/projects") {
        assertMutationRequest(request, expectedOrigin);
        const input = await readJsonBody(request);
        const selection = validateProviderSelection(input.provider, input.model);
        const status = await providerStatus(selection.provider);
        if (!status.connected) throw new HttpError(401, status.reason || `${PROVIDERS[selection.provider].subscriptionLabel} is required.`, "subscription_required", { provider: selection.provider });
        const project = await projectService.create(input);
        const job = await jobs.enqueue({ projectSlug: project.slug, action: "directions" });
        return json(response, 202, { project, job });
      }

      const projectMatch = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)$/);
      if (request.method === "GET" && projectMatch) {
        try {
          return json(response, 200, await projectService.readPublic(projectMatch[1]));
        } catch (error) {
          if (!(error instanceof HttpError) || error.code !== "project_not_found") throw error;
          const catalog = await buildCatalog({ projectsDir });
          if (!catalog.projects.some((project) => project.slug === projectMatch[1])) throw error;
          return json(response, 200, { managed: false, slug: projectMatch[1] });
        }
      }

      const runMatch = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/runs$/);
      if (request.method === "POST" && runMatch) {
        assertMutationRequest(request, expectedOrigin);
        const slug = runMatch[1];
        const input = await readJsonBody(request, { maxBytes: 64 * 1024 });
        const action = String(input.action || "");
        if (!ACTION_STAGES[action]) throw new HttpError(400, "Unknown generation action.", "invalid_action");
        const project = await projectService.read(slug);
        const status = await providerStatus(project.agent.provider);
        if (!status.connected) throw new HttpError(401, status.reason || `${PROVIDERS[project.agent.provider].subscriptionLabel} is required.`, "subscription_required", { provider: project.agent.provider });
        if (project.workflow.activeJobId) {
          throw new HttpError(409, "This project already has an active generation job.", "project_busy");
        }
        if (!ACTION_STAGES[action].has(project.workflow.stage)) {
          throw new HttpError(409, `The ${action} action is not available at the current workflow stage.`, "invalid_workflow_stage", { stage: project.workflow.stage });
        }
        const selection = cleanRunText(input.selection, "Selection", 500);
        const feedback = cleanRunText(input.feedback, "Feedback", 4000);
        if (["refinements", "revision"].includes(action) && !selection) {
          throw new HttpError(400, "Select a direction or refinement before continuing.", "selection_required");
        }
        const projectDir = projectService.projectDir(slug);
        if (await targetExists(projectDir, action) && input.confirmOverwrite !== true) {
          throw new HttpError(409, `${outputNameForAction(action)} already exists. Confirm replacement to continue.`, "overwrite_confirmation_required", { filename: outputNameForAction(action) });
        }
        const job = await jobs.enqueue({ projectSlug: slug, action, selection, feedback });
        return json(response, 202, { project: projectService.public(project), job });
      }

      const jobMatch = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)$/);
      if (request.method === "GET" && jobMatch) {
        const job = jobs.get(jobMatch[1]);
        if (!job) throw new HttpError(404, "Generation job not found.", "job_not_found");
        return json(response, 200, job);
      }

      const cancelMatch = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)\/cancel$/);
      if (request.method === "POST" && cancelMatch) {
        assertMutationRequest(request, expectedOrigin);
        const job = await jobs.cancel(cancelMatch[1]);
        if (!job) throw new HttpError(404, "Generation job not found.", "job_not_found");
        return json(response, 202, job);
      }

      const eventsMatch = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)\/events$/);
      if (request.method === "GET" && eventsMatch) {
        const job = jobs.get(eventsMatch[1]);
        if (!job) throw new HttpError(404, "Generation job not found.", "job_not_found");
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        response.write("retry: 1500\n\n");
        sendSse(response, { id: "snapshot", type: "snapshot", job });
        for (const event of job.events) sendSse(response, event);
        if (TERMINAL_JOB_STATES.has(job.state)) return response.end();
        const unsubscribe = jobs.subscribe(job.id, (event, currentJob) => {
          sendSse(response, event);
          if (TERMINAL_JOB_STATES.has(currentJob.state)) {
            clearInterval(heartbeat);
            unsubscribe();
            response.end();
          }
        });
        const heartbeat = setInterval(() => response.write(": keep-alive\n\n"), 15000);
        request.once("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
        return;
      }

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/hifi-designer-workspace.html")) {
        if (url.pathname === "/") {
          response.writeHead(302, { Location: "/hifi-designer-workspace.html", "Cache-Control": "no-store" });
          return response.end();
        }
        const source = await readFile(path.join(repoRoot, path.basename(WORKSPACE_FILE)));
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": source.length,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'; frame-src 'self' data: blob:; base-uri 'none'; form-action 'self'",
        });
        return response.end(source);
      }

      throw new HttpError(404, "Not found.", "not_found");
    } catch (error) {
      if (response.headersSent) return response.end();
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      return json(response, statusCode, {
        error: {
          code: error instanceof HttpError ? error.code : "internal_error",
          message: statusCode === 500 ? "The local workspace encountered an unexpected error." : safeError(error),
          ...(error instanceof HttpError && error.details ? { details: error.details } : {}),
        },
      });
    }
  }

  return { handle, jobs, projectService, runners };
}

export async function startWorkspaceServer({ port = parsePort() } = {}) {
  await buildWorkspace();
  const application = createWorkspaceApplication({ port });
  const server = createServer(application.handle);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { server, url: `http://127.0.0.1:${port}/hifi-designer-workspace.html`, application };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  startWorkspaceServer()
    .then(({ server, url }) => {
      console.log(`Hi-Fi Designer is running at ${url}`);
      console.log("Press Ctrl+C to stop the local server.");
      const shutdown = () => server.close(() => process.exit(0));
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    })
    .catch((error) => {
      console.error(safeError(error));
      process.exitCode = 1;
    });
}
