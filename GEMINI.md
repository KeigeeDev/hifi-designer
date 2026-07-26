# GEMINI.md

Context for Gemini CLI. Like AGENTS.md, GEMINI.md is **always-on** — its contents are
concatenated into every prompt — so keep it short and pull detail in on demand rather
than inlining a long workflow here.

Gemini CLI supports modular imports with `@path/to/file.md`. The design workflow is
imported below so it's available when needed without bloating this file's own prose.
(If your Gemini surface doesn't resolve `@`-imports, treat the lines below as
instructions to open those files when the task calls for it.)

## Hi-fi visual design tasks

When the user wants to **design or mock up a web page, landing page, hero, or UI as
rendered HTML** — explore aesthetic directions, produce variations, or build a
high-fidelity mockup — follow the imported workflow:

- Workflow: @docs/hifi-design.md
- Anti-slop guardrails (read before generating): @docs/design-quality.md
- Drop-in live-tuning bar (embed in every refinement output): @docs/tweaks-bar.html
- Final handoff: after fine-tuning, ask whether to export clean standalone HTML or
  apply another round of revisions, following Step 5 in @docs/hifi-design.md.

**Non-negotiables for design output:**
- Standalone HTML — all CSS/JS inline, no build step, CDN fonts/icons only.
- Token-first — `--accent`, `--font-scale`, `--space-scale`, `--radius` on `:root`,
  used throughout, so the tweaks bar can drive them.
- Real copy, never lorem ipsum.
- Collect all four brief inputs (aesthetic, references, intent/audience, guardrails)
  before generating; ask for anything missing instead of guessing.

> Note: For Gemini surfaces that support **Skills** (on-demand expertise invoked by
> description match), a Skill is the more idiomatic home for this than always-on
> GEMINI.md — the same reasoning that makes it a Claude skill. Use this GEMINI.md
> router if you're on Gemini CLI or a surface without skills.
