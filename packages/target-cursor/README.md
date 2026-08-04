# bapm-target-cursor

Minimal **Cursor** host for bapm (M5 polish + M9 MCP configure).

## Detection vs forced target

| Mode                           | When active                                                                    | Creates roots?                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Auto-detect**                | `.cursor/` **directory** **or** legacy `.cursorrules` **file** at project root | Only when materialize / configureMcp runs after a positive detect                                        |
| **Forced** (`--target cursor`) | Explicit CLI/core forced target id, even if detect is false                    | MAY `mkdir` registered roots (`.cursor/`, `.agents/skills`, `.cursor/rules`, `.cursor/agents`) as needed |

Auto-detect without force MUST NOT create `.cursor/` solely for MCP opt-in. Forced activation is owned by Install / CLI; this package’s `detect` stays an honest presence predicate.

## Deploy roots (tg-002 / tg-003)

Registered roots:

- `.agents/skills` — skills → `<name>/SKILL.md`
- `.cursor` — companion root (detection + rules/agents + MCP config)

## Materialize routing

| Primitive type | Destination                      |
| -------------- | -------------------------------- |
| skill          | `.agents/skills/<name>/SKILL.md` |
| instruction    | `.cursor/rules/<name>.mdc`       |
| agent          | `.cursor/agents/<name>.md`       |

Thin copy/write from source content (minimal frontmatter only when content is missing). Writes are idempotent overwrites and never escape registered roots.

**Skills / rules / agents materialize does not write `.cursor/mcp.json`.** MCP config is written only via the separate `configureMcp` path when install requests it.

`materialize` returns a `MaterializeReport` (`deployedFiles: { path }[]`) via `bapm-target-api` for lock inventory.

## MCP configure (`configureMcp`)

When install invokes `configureMcp` with eligible servers:

- Writes / updates `.cursor/mcp.json` under the registered `.cursor/` root only
- Shape: `{ "mcpServers": { "<name>": { "command"|"url"|… } } }` (stdio / http)
- Idempotent overwrite of bapm-owned server keys (keyed by server name); unknown user keys are preserved when present
- Returns a `ConfigureMcpReport` (`configPath`, `servers`, `deployedFiles`) for lock `mcp_*` inventory

## Dependencies

Depends only on `bapm-target-api` among bapm packages — not `@bapm/core`.
Shared materialize helpers (`sanitizeName`, `assertUnderDeployRoots`, `readPrimitiveContent`, …) come from `bapm-target-api`; this package keeps Cursor detect and path routing only.
Register via `createTargetRegistry().register(createCursorTarget())` in CLI or tests.
