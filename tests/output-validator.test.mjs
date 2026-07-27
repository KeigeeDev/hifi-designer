import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateOutput } from "../server/output-validator.mjs";

async function withTempDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hifi-output-validator-"));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

function html({ tweaks = false, body = "A complete brief-specific design preview with enough content for validation." } = {}) {
  return `<!doctype html><html><head><style>:root{--accent:#1646ff;--font-scale:1;--space-scale:1;--radius:8px}body{font-family:serif;margin:0;padding:3rem}</style></head><body><main><h1>Northstar analytics</h1><p>${body}</p></main>${tweaks ? '<aside data-tweaks-bar><button type="button">Tune</button></aside>' : ""}</body></html>`;
}

test("directions output validates without a tweaks bar", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(path.join(directory, "directions.html"), html(), "utf8");
    const result = await validateOutput(directory, "directions");
    assert.equal(result.filename, "directions.html");
  });
});

test("refinement output requires a tweaks bar", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(path.join(directory, "refinements.html"), html(), "utf8");
    await assert.rejects(() => validateOutput(directory, "refinements"), error => error.code === "missing_tweaks_bar");
    await writeFile(path.join(directory, "refinements.html"), html({ tweaks: true }), "utf8");
    assert.equal((await validateOutput(directory, "refinements")).filename, "refinements.html");
  });
});

test("generated outputs containing credentials or external media are blocked", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(path.join(directory, "directions.html"), html({ body: `sk-${"a".repeat(30)}` }), "utf8");
    await assert.rejects(() => validateOutput(directory, "directions"), error => error.code === "secret_detected");
    await writeFile(path.join(directory, "directions.html"), html({ body: '<img src="https://example.com/private.png" alt="">' }), "utf8");
    await assert.rejects(() => validateOutput(directory, "directions"), error => error.code === "external_media_blocked");
  });
});
