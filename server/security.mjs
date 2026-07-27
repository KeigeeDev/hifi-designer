const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /\bAIza[A-Za-z0-9_-]{30,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b(?:OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN|API_KEY|ACCESS_TOKEN)\s*[:=]\s*[^\s"']+/gi,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

export class HttpError extends Error {
  constructor(statusCode, message, code = "request_error", details = undefined) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function containsSecret(value) {
  const text = String(value ?? "");
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function redactSecrets(value) {
  let text = String(value ?? "");
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, "[REDACTED]");
  }
  return text;
}

export function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactSecrets(message).slice(0, 800);
}

export function assertLoopbackHost(request) {
  const host = String(request.headers.host || "").toLowerCase();
  if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)) {
    throw new HttpError(403, "This service accepts localhost requests only.", "invalid_host");
  }
}

export function assertSameOrigin(request, expectedOrigin) {
  const origin = request.headers.origin;
  if (origin && origin !== expectedOrigin) {
    throw new HttpError(403, "The request origin is not allowed.", "invalid_origin");
  }
}

export async function readJsonBody(request, { maxBytes = 8 * 1024 * 1024 } = {}) {
  const contentType = String(request.headers["content-type"] || "").split(";", 1)[0];
  if (contentType !== "application/json") {
    throw new HttpError(415, "Expected an application/json request body.", "invalid_content_type");
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of request) {
    received += chunk.length;
    if (received > maxBytes) {
      throw new HttpError(413, "The request body is too large.", "request_too_large");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.", "invalid_json");
  }
}

export function buildSanitizedCodexEnvironment(source = process.env) {
  const allowedNames = [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "TEMP",
    "TMP",
    "PROGRAMFILES",
    "PROGRAMFILES(X86)",
    "PROGRAMDATA",
    "CODEX_HOME",
    "LANG",
    "LC_ALL",
  ];
  const result = {};
  for (const name of allowedNames) {
    if (source[name] && !containsSecret(source[name])) result[name] = source[name];
  }
  return result;
}

export function buildSanitizedClaudeEnvironment(source = process.env) {
  const allowedNames = [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "TEMP",
    "TMP",
    "PROGRAMFILES",
    "PROGRAMFILES(X86)",
    "PROGRAMDATA",
    "CLAUDE_CONFIG_DIR",
    "LANG",
    "LC_ALL",
  ];
  const result = {};
  for (const name of allowedNames) {
    if (source[name] && !containsSecret(source[name])) result[name] = source[name];
  }
  return result;
}
