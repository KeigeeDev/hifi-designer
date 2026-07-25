# Hi-Fi Design Generator — portable (Codex / Cursor / Gemini)

The same hi-fi-design capability as the Claude skill, ported to the instruction-file
conventions of other agents. One shared workflow, three tool-native entry points.

## What's here

```text
hifi-designer/
|-- docs/                         design workflow and quality guidance
|-- projects/                     local-only project designs (Git-ignored)
|-- scripts/
|   `-- build-workspace.mjs       standalone catalog generator
|-- tests/
|   `-- build-workspace.test.mjs  generator and workspace tests
|-- AGENTS.md                     agent instructions
|-- PRODUCT.md                    product context
|-- DESIGN.md                     workspace design system
|-- workspace.template.html       editable dashboard source
|-- start-workspace.ps1           local launcher implementation
`-- start-workspace.cmd           Windows launcher
```

The three entry points all route to the same `docs/` — edit the workflow once and
every tool picks it up.

## The one concept that shaped this

Claude skills load **on-demand**: the description triggers them only when relevant, so
the body can be long. `AGENTS.md` and `GEMINI.md` are **always-on**: their contents
are prepended to *every* prompt. Pasting a 150-line design workflow into an always-on
file would tax every unrelated request. So those two files are thin routers that point
to `docs/hifi-design.md` instead of inlining it. Cursor's `.mdc` can be genuinely
on-demand (`alwaysApply: false` + a `description`), so it behaves most like the
original skill.

## Install per tool

**Codex** — drop `AGENTS.md` at your repo root (also readable at
`~/.codex/AGENTS.md` for a global rule). Keep the `docs/` folder in the repo so the
router's paths resolve. AGENTS.md is the Linux Foundation cross-tool standard, so this
same file also works in Cursor, Copilot, Windsurf, Aider, and more.

**Cursor** — put `.cursor/rules/hifi-design.mdc` and `docs/` in your project. The rule
is Agent-Requested, so it loads only when a task matches its `description`. (Cursor
also reads `AGENTS.md` if you'd rather use that.)

**Gemini** — drop `GEMINI.md` at your repo root with the `docs/` folder alongside.
Gemini CLI concatenates `GEMINI.md` on every prompt and resolves the `@docs/...`
imports. Gemini CLI also reads `AGENTS.md`, and Gemini surfaces that support Skills
can host this as a Skill instead — more idiomatic for on-demand use.

## Editing

Change the design behavior in `docs/hifi-design.md`; tune the banned-list and
quality bar in `docs/design-quality.md`; adjust the live controls in
`docs/tweaks-bar.html`. The entry-point files rarely need to change.

## Local project browser

The browser is repository tooling, so its editable `workspace.template.html` and
generated `hifi-designer-workspace.html` stay in the repository root. Only actual
design projects belong under `projects/`.

Generated designs live as direct HTML files under a named project:

```text
projects/
└── project-name/
    ├── home.html
    └── about.html
```

Rebuild the standalone browser after adding or changing a page:

```powershell
node scripts/build-workspace.mjs
```

Then open
the root `hifi-designer-workspace.html` in a browser. The catalog embeds every direct
project HTML file and supports fit/desktop/tablet/mobile preview widths. The tweaks
dock appears only while viewing a project page and applies only to that active
preview. Nested HTML files, hidden folders, and empty folders are excluded.

To rebuild, serve, and open the workspace in one step, run:

```powershell
.\start-workspace.cmd
```

The default address is `http://localhost:8080/hifi-designer-workspace.html`. Pass a
different port when needed, for example `.\start-workspace.cmd -Port 3000`. The
wrapper calls `start-workspace.ps1` with a temporary execution-policy bypass. Keep
the terminal open and press `Ctrl+C` to stop the server.
