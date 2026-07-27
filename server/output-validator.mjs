import { copyFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { HttpError, containsSecret } from "./security.mjs";

export const ACTION_OUTPUTS = Object.freeze({
  directions: "directions.html",
  refinements: "refinements.html",
  revision: "refined.html",
  final: "final.html",
});

const REQUIRED_TOKENS = ["--accent", "--font-scale", "--space-scale", "--radius"];
const MAX_HTML_BYTES = 12 * 1024 * 1024;

export function outputNameForAction(action) {
  const filename = ACTION_OUTPUTS[action];
  if (!filename) throw new HttpError(400, "Unknown generation action.", "invalid_action");
  return filename;
}

export async function targetExists(projectDir, action) {
  try {
    await stat(path.join(projectDir, outputNameForAction(action)));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function validateOutput(runtimeDir, action) {
  const filename = outputNameForAction(action);
  const sourcePath = path.resolve(runtimeDir, filename);
  if (path.dirname(sourcePath) !== path.resolve(runtimeDir)) {
    throw new HttpError(400, "Invalid generated output path.", "invalid_output_path");
  }

  let source;
  try {
    const fileStat = await stat(sourcePath);
    if (fileStat.size < 200 || fileStat.size > MAX_HTML_BYTES) {
      throw new HttpError(422, "Generated HTML has an unexpected file size.", "invalid_generated_html");
    }
    source = await readFile(sourcePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new HttpError(422, `The agent did not create ${filename}.`, "missing_generated_output");
    }
    throw error;
  }

  const lower = source.toLowerCase();
  if (!/^\s*<!doctype html>/i.test(source) || !lower.includes("<html") || !lower.includes("<style")) {
    throw new HttpError(422, "Generated output is not a standalone HTML document.", "invalid_generated_html");
  }
  for (const token of REQUIRED_TOKENS) {
    if (!source.includes(token)) {
      throw new HttpError(422, `Generated HTML is missing the ${token} design token.`, "missing_design_token");
    }
  }
  if (/<script\b[^>]*\bsrc\s*=/i.test(source)) {
    throw new HttpError(422, "Generated HTML may not load external scripts.", "external_script_blocked");
  }
  if (/<(?:img|video|audio|source)\b[^>]*\bsrc\s*=\s*["'](?!data:)[^"']+/i.test(source)) {
    throw new HttpError(422, "Generated HTML contains a non-embedded media dependency.", "external_media_blocked");
  }
  if (/\bsrcset\s*=\s*["'](?!data:)[^"']+/i.test(source)) {
    throw new HttpError(422, "Generated HTML contains an external media dependency.", "external_media_blocked");
  }
  if (/(?:src|href)\s*=\s*["'](?:\.\.?\/|file:|[a-z]:\\)/i.test(source)) {
    throw new HttpError(422, "Generated HTML contains a local file dependency.", "local_asset_blocked");
  }
  if (containsSecret(source)) {
    throw new HttpError(422, "Generated HTML appears to contain a credential and was not published.", "secret_detected");
  }

  const hasTweaksBar = /data-tweaks-bar/i.test(source);
  if (["refinements", "revision"].includes(action) && !hasTweaksBar) {
    throw new HttpError(422, "Refinement output is missing the required tweaks bar.", "missing_tweaks_bar");
  }
  if (["directions", "final"].includes(action) && hasTweaksBar) {
    throw new HttpError(422, `${filename} must not include the tweaks bar.`, "unexpected_tweaks_bar");
  }

  return { filename, sourcePath, bytes: Buffer.byteLength(source) };
}

export async function publishOutput(projectDir, validatedOutput) {
  const destination = path.resolve(projectDir, validatedOutput.filename);
  if (path.dirname(destination) !== path.resolve(projectDir)) {
    throw new HttpError(400, "Invalid publish destination.", "invalid_output_path");
  }
  await copyFile(validatedOutput.sourcePath, destination);
  return destination;
}
