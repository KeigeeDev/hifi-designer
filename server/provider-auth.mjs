import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import { buildSanitizedClaudeEnvironment, buildSanitizedCodexEnvironment, HttpError } from "./security.mjs";

const execFileAsync = promisify(execFile);

export function parseCodexLoginStatus(rawStatus) {
  const status = String(rawStatus || "");
  const connected = /logged in/i.test(status)
    && !/(?:not logged in|logged out)/i.test(status)
    && /chatgpt/i.test(status)
    && !/api key/i.test(status);
  return {
    connected,
    method: connected ? "ChatGPT subscription" : null,
    reason: connected ? null : "Sign in to Codex with ChatGPT subscription access.",
  };
}

export async function codexLoginStatus() {
  const executable = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "codex";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "codex login status"] : ["login", "status"];
  try {
    const { stdout, stderr } = await execFileAsync(executable, args, {
      env: buildSanitizedCodexEnvironment(),
      windowsHide: true,
      timeout: 6000,
      maxBuffer: 64 * 1024,
    });
    return parseCodexLoginStatus(`${stdout}\n${stderr}`);
  } catch {
    return { connected: false, method: null, reason: "Codex is not installed or signed in." };
  }
}

export function parseClaudeSubscriptionStatus(rawStatus) {
  try {
    const status = typeof rawStatus === "string" ? JSON.parse(rawStatus) : rawStatus;
    const plan = String(status?.subscriptionType || "").toLowerCase();
    const subscriptionPlan = /^(?:pro|max|team|enterprise)/.test(plan);
    const connected = status?.loggedIn === true && status.authMethod === "claude.ai" && subscriptionPlan;
    return {
      connected,
      method: connected ? "Claude subscription" : null,
      plan: connected ? plan : null,
      reason: connected ? null : "Sign in with a paid Claude subscription. Console API billing is not accepted.",
    };
  } catch {
    return { connected: false, method: null, plan: null, reason: "Claude Code returned an unreadable authentication status." };
  }
}

export async function claudeSubscriptionStatus() {
  try {
    const { stdout } = await execFileAsync("claude", ["auth", "status", "--json"], {
      env: buildSanitizedClaudeEnvironment(),
      windowsHide: true,
      timeout: 6000,
      maxBuffer: 64 * 1024,
    });
    return parseClaudeSubscriptionStatus(stdout);
  } catch {
    return { connected: false, method: null, plan: null, reason: "Claude Code is not installed or signed in." };
  }
}

export async function assertClaudeSubscription() {
  const status = await claudeSubscriptionStatus();
  if (!status.connected) {
    throw new HttpError(401, status.reason, "claude_subscription_required");
  }
  return status;
}

const loginProcesses = new Map();

function startLogin(id, executable, args, env) {
  const current = loginProcesses.get(id);
  if (current && current.exitCode === null) return;
  const child = spawn(executable, args, { detached: true, env, stdio: "ignore", windowsHide: true });
  loginProcesses.set(id, child);
  child.once("error", () => loginProcesses.delete(id));
  child.once("exit", () => loginProcesses.delete(id));
  child.unref();
}

export function startProviderLogin(provider) {
  if (provider === "codex") {
    const executable = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "codex";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", "codex login"] : ["login"];
    startLogin(provider, executable, args, buildSanitizedCodexEnvironment());
    return "Codex ChatGPT sign-in opened in your browser.";
  }
  if (provider === "claude") {
    startLogin(provider, "claude", ["auth", "login", "--claudeai"], buildSanitizedClaudeEnvironment());
    return "Claude subscription sign-in opened in your browser.";
  }
  throw new HttpError(404, "Unknown agent provider.", "provider_not_found");
}
