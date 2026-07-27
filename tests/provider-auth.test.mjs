import assert from "node:assert/strict";
import test from "node:test";

import { parseClaudeSubscriptionStatus, parseCodexLoginStatus } from "../server/provider-auth.mjs";

test("Codex auth status accepts ChatGPT subscription login and rejects misleading or API-key status", () => {
  assert.equal(parseCodexLoginStatus("Logged in using ChatGPT").connected, true);
  assert.equal(parseCodexLoginStatus("Not logged in to ChatGPT").connected, false);
  assert.equal(parseCodexLoginStatus("Logged in using API key").connected, false);
});

test("Claude auth status accepts paid claude.ai subscriptions without exposing account data", () => {
  const status = parseClaudeSubscriptionStatus({
    loggedIn: true,
    authMethod: "claude.ai",
    subscriptionType: "pro",
    email: "private@example.test",
    orgName: "Private Org",
  });
  assert.deepEqual(status, {
    connected: true,
    method: "Claude subscription",
    plan: "pro",
    reason: null,
  });
  assert.equal(JSON.stringify(status).includes("private@example.test"), false);
});

test("Claude auth status rejects API-console and unpaid authentication", () => {
  assert.equal(parseClaudeSubscriptionStatus({ loggedIn: true, authMethod: "console", subscriptionType: "pro" }).connected, false);
  assert.equal(parseClaudeSubscriptionStatus({ loggedIn: true, authMethod: "claude.ai", subscriptionType: "free" }).connected, false);
  assert.equal(parseClaudeSubscriptionStatus("not json").connected, false);
});
