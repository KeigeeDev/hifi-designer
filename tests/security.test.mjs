import assert from "node:assert/strict";
import test from "node:test";

import { buildSanitizedClaudeEnvironment, buildSanitizedCodexEnvironment, containsSecret, redactSecrets } from "../server/security.mjs";

test("Codex receives only the environment values needed for local execution and auth lookup", () => {
  const environment = buildSanitizedCodexEnvironment({
    PATH: "C:\\tools",
    USERPROFILE: "C:\\Users\\designer",
    OPENAI_API_KEY: `sk-${"x".repeat(32)}`,
    DATABASE_URL: "postgres://user:password@example.test/db",
  });
  assert.equal(environment.PATH, "C:\\tools");
  assert.equal(environment.USERPROFILE, "C:\\Users\\designer");
  assert.equal("OPENAI_API_KEY" in environment, false);
  assert.equal("DATABASE_URL" in environment, false);
});

test("Claude receives subscription login paths but never API billing credentials", () => {
  const environment = buildSanitizedClaudeEnvironment({
    PATH: "C:\\tools",
    USERPROFILE: "C:\\Users\\designer",
    CLAUDE_CONFIG_DIR: "C:\\Users\\designer\\.claude",
    ANTHROPIC_API_KEY: `sk-ant-${"x".repeat(32)}`,
    ANTHROPIC_AUTH_TOKEN: "private-token",
    CLAUDE_CODE_OAUTH_TOKEN: "private-oauth-token",
  });
  assert.equal(environment.USERPROFILE, "C:\\Users\\designer");
  assert.equal(environment.CLAUDE_CONFIG_DIR, "C:\\Users\\designer\\.claude");
  assert.equal("ANTHROPIC_API_KEY" in environment, false);
  assert.equal("ANTHROPIC_AUTH_TOKEN" in environment, false);
  assert.equal("CLAUDE_CODE_OAUTH_TOKEN" in environment, false);
});

test("credential signatures are detected and redacted", () => {
  const secret = `sk-${"a".repeat(30)}`;
  assert.equal(containsSecret(secret), true);
  assert.equal(redactSecrets(`token=${secret}`), "token=[REDACTED]");
});
