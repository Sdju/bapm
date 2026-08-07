## Why

APM authors MCP secrets in `dependencies.mcp` with placeholders (`${VAR}`, `${env:VAR}`, legacy `<VAR>`). On Cursor, APM does **not** leave runtime substitution — it **bakes** resolved literals into `.cursor/mcp.json` at install time. bapm currently copies `env`/`headers` as-is, so Cursor MCP auth that works under APM breaks or leaks placeholder strings. Closing this gap is required for Cursor MCP parity.

## What Changes

- Add install-time (bake-time) resolution of APM/OpenAPM MCP placeholder syntaxes in `env` (and `headers` when present) before Cursor `configureMcp` writes `.cursor/mcp.json`.
- Resolve from explicit overrides (if/when exposed) then `process.env`; fail closed when a required placeholder cannot be resolved (non-interactive default; no silent leave-as-placeholder for secret maps).
- Keep Cursor as **legacy bake** only — **no** runtime `${VAR}` translate-mode (matches APM Cursor pin).
- Document authoring syntax and Cursor bake behavior in user docs (`config-manifest` / MCP situations as needed).
- **Non-goals:** Copilot/IntelliJ/VS Code translate-mode; interactive TTY prompts for missing vars (APM Prompt.ask); changing Agent Plugins secret-key refuse / `${PLUGIN_*}` only; inventing a `{env}` single-brace secret template; baking secrets into lockfile as plaintext inventory beyond what already ships.

## Capabilities

### New Capabilities

- `mcp-env-bake`: Shared bake-time resolver for MCP `env`/`headers` placeholder syntaxes (`${VAR}`, `${env:VAR}`, legacy `<VAR>`), used before host MCP config write on Cursor.

### Modified Capabilities

- `cursor-mcp-deploy`: Eligible MCP servers MUST be bake-resolved before writing `.cursor/mcp.json`.
- `integration-cursor-runtime`: Cursor `configureMcp` MUST consume bake-resolved env/headers (or resolve at the boundary consistently with core), never write unresolved secret placeholders when bake is required.

## Impact

- `@bapm/core` — new small bake helper (likely under `Mcp` or `Install`); wire into install → `configureMcp` path.
- `@bapm/integration-cursor` — ensure written `mcpServers` entries use baked values; tests for placeholder → literal.
- CLI — optional later: env overrides flag parity with APM; floor is `process.env` + fail-closed.
- Docs — `apps/docs` mention of MCP env placeholders + Cursor bake.
- Tests — core unit + CLI/integration install with `${TOKEN}` style env; Agent Plugins path unchanged.
