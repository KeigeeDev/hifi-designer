# Local security boundary

Hi-Fi Designer is a single-user localhost application. It is not designed to be
exposed to a LAN, reverse proxy, shared host, or public URL.

## Authentication

- Codex authentication is managed by the installed Codex CLI; Claude authentication
  is managed by the installed Claude Code CLI.
- Codex must report a ChatGPT login. Claude must report `claude.ai` authentication and
  a paid Pro, Max, Team, or Enterprise subscription. Console/API billing is rejected.
- The service never asks for, stores, logs, or returns access tokens or API keys.
- The browser sees only connection state, provider/model catalogs, and a broad plan
  label such as `PRO`; it never receives email, organization, or credential data.
- Agent child processes inherit an allowlist of operating-system paths needed to find
  local login state. OpenAI and Anthropic API-key/token environment variables and all
  unrelated environment variables are omitted.

## Filesystem and generated output

- Project slugs are normalized and resolved beneath `projects/`.
- Agent work is staged beneath the ignored `.hifi-runtime/` directory.
- Only the expected direct HTML filename is eligible for publishing.
- Output is rejected if it contains credential signatures, local file dependencies,
  external scripts, external media, missing design tokens, or an invalid tweaks-bar
  state for its workflow stage.
- Project briefs, session IDs, screenshots, runtime files, and generated project HTML
  remain ignored by Git.

## Browser boundary

- The server binds to `127.0.0.1` only.
- Host headers, browser origins, mutation headers, body sizes, image types, and image
  sizes are validated.
- API errors are sanitized and never include stack traces.
- Streamed browser progress contains lifecycle summaries only. Agent reasoning,
  commands, raw prompts, and session IDs are not returned.
- Generated previews run in an opaque iframe sandbox without same-origin access. A
  restrictive preview CSP blocks network connections, external media, and form
  submission; a narrow `postMessage` bridge carries only the four visual tweak values.

Before committing, run `npm test` and audit tracked files for credential signatures.
