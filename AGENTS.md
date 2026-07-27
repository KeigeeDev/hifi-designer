# AGENTS.md

Instructions for AI coding agents in this project. AGENTS.md is read natively by
Codex, Cursor, Gemini CLI, Copilot, Windsurf, Aider, and others. It is **always-on**
context — prepended to every prompt — so it stays short and routes to detailed docs
instead of inlining them.

## Hi-fi visual design tasks

When the user wants to **design or mock up a web page, landing page, hero section, or
UI as rendered HTML** — explore aesthetic directions, produce design variations, or
build a high-fidelity mockup:

1. Read and follow `docs/hifi-design.md` end to end (the full workflow: assemble
   brief → 5 wide-net variations → choose + ~3 sub-variations → refine).
2. Read `docs/design-quality.md` **before generating the first design** — it is the
   anti-slop guardrail layer (no purple gradients, no default-Inter-only, no 3D blobs,
   no lorem ipsum, etc.).
3. Embed `docs/tweaks-bar.html` in every refinement-stage output so the user can tune
   type, color, and spacing live.
4. After the chosen direction has been adjusted, ask whether the user wants a clean
   standalone HTML export or another round of revisions. Follow the Step 5 handoff in
   `docs/hifi-design.md`.

**Non-negotiables for design output:**
- Standalone HTML — all CSS/JS inline, no build step, CDN fonts/icons only.
- Token-first — define `--accent`, `--font-scale`, `--space-scale`, `--radius` on
  `:root` and use them everywhere (this is what makes the tweaks bar work).
- Collect all four brief inputs (aesthetic, references, intent/audience, guardrails)
  before generating; ask for missing ones rather than guessing.

## Project output directory

Store every generated design inside `projects/<project-name>/`. Create the project
directory when it does not exist, using the user's project name or a concise,
descriptive kebab-case name derived from the brief. Keep all contact sheets,
variations, refinements, and final HTML files for that project together in this
directory. Do not put generated design files in the repository root or in `docs/`.
The Hi-Fi Designer workspace is repository tooling rather than a design project, so
its template and generated dashboard stay in the repository root and are never
cataloged under `projects/`.

After adding or changing a direct HTML file in any project, run
`node scripts/build-workspace.mjs` to rebuild the local project browser. Edit
the root `workspace.template.html` when changing the browser itself; do not hand-edit
the generated root `hifi-designer-workspace.html` output.

When an agent is launched by the dashboard service, it works in an ignored staging
directory with a dashboard-specific override. In that environment, write only the
requested staged HTML file and do not run the workspace builder; the trusted host
validates the output, publishes it to `projects/<project-name>/`, and rebuilds the
catalog.
