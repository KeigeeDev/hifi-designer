import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ACTION_OUTPUTS } from "./output-validator.mjs";

export const DESIGN_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    summary: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          purpose: { type: "string" },
        },
        required: ["path", "purpose"],
        additionalProperties: false,
      },
    },
    nextStep: { type: "string" },
  },
  required: ["summary", "files", "nextStep"],
  additionalProperties: false,
});

export function buildDesignPrompt(project, action, selection, feedback, referencePaths = []) {
  const output = ACTION_OUTPUTS[action];
  const stageInstructions = {
    directions: `Generate the five genuinely distinct wide-net directions as one scrollable contact sheet named ${output}. Do not include the tweaks bar.`,
    refinements: `The user selected direction "${selection}". Generate about three sibling sub-variations as one contact sheet named ${output}. Include the complete docs/tweaks-bar.html component in this refinement-stage output.`,
    revision: `The user selected refinement "${selection}". Produce one polished responsive design named ${output}. Include the complete docs/tweaks-bar.html component.`,
    final: `Create the clean final standalone export named ${output}. Bake in the accepted design choices, optimize embedded raster images when useful, and remove all tweak and workspace controls.`,
  }[action];
  const references = referencePaths.length
    ? `\nReference screenshots are available inside this staging workspace:\n${referencePaths.map((entry) => `- ${entry}`).join("\n")}\nInspect them with the image-capable read tool before designing.`
    : "";

  return `You are running inside the Hi-Fi Designer's private staging workspace.

Read AGENTS.md, docs/hifi-design.md, and docs/design-quality.md before working. Read docs/tweaks-bar.html when the current stage requires it.

Brief
- Project: ${project.name}
- Aesthetic: ${project.brief.aesthetic}
- References: ${project.brief.references}
- Intent: ${project.brief.intent}
- Audience: ${project.brief.audience}
- Primary action: ${project.brief.primaryAction}
- Guardrails: ${project.brief.guardrails}${references}

Task
${stageInstructions}
${feedback ? `User feedback: ${feedback}` : ""}

Work only inside the current staging directory. Do not inspect environment variables, authentication files, or unrelated user files. Do not run the repository workspace builder; the host application validates and publishes the result. Do not create any file other than the requested HTML output. The brief is complete, so proceed without asking questions.

The HTML must be standalone, token-first, responsive, accessible, use real brief-specific copy, and define --accent, --font-scale, --space-scale, and --radius on :root. External scripts and local asset dependencies are forbidden. Return the requested structured summary after verifying the file.`;
}

export async function prepareDesignRuntime({ repoRoot, projectService, project }) {
  const runtimeDir = projectService.projectRuntimeDir(project.slug);
  await mkdir(path.join(runtimeDir, "docs"), { recursive: true });
  const rootAgents = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");
  await writeFile(
    path.join(runtimeDir, "AGENTS.md"),
    `${rootAgents}\n\n## Dashboard staging override\n\nWrite the requested design only in this staging directory. The dashboard service validates, publishes, and rebuilds the project browser after the turn.\n`,
    "utf8",
  );
  for (const filename of ["hifi-design.md", "design-quality.md", "tweaks-bar.html"]) {
    await copyFile(path.join(repoRoot, "docs", filename), path.join(runtimeDir, "docs", filename));
  }

  const imagePaths = [];
  if (project.referenceImages.length) {
    await mkdir(path.join(runtimeDir, "references"), { recursive: true });
    const projectDir = projectService.projectDir(project.slug);
    for (const image of project.referenceImages) {
      const source = path.join(projectDir, image.relativePath);
      const destination = path.join(runtimeDir, "references", image.name);
      await copyFile(source, destination);
      imagePaths.push(destination);
    }
  }
  return { runtimeDir, imagePaths };
}
