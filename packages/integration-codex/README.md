# @b-apm/integration-codex

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Codex CLI **runtime** host for bapm, plus Codex **marketplace pack** mapper in the same package.

## Dual surface

| Capability                | Export                                                | When                               |
| ------------------------- | ----------------------------------------------------- | ---------------------------------- |
| Runtime install / compile | `createCodexIntegration` / `createIntegration`        | `targets.codex` / `--target codex` |
| Marketplace pack          | `codexMarketplaceIntegration` / `mapCodexMarketplace` | `bapm pack --marketplace codex`    |

Marketplace mapping stays available without activating the runtime factory.

## Detection vs forced target

| Mode                          | When active                                        | Creates roots?                                                          |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| **Auto-detect**               | project-root `.codex/` **directory** only          | Only when materialize / configureMcp runs after a positive detect       |
| **Forced** (`--target codex`) | Explicit forced target id, even if detect is false | MAY `mkdir` `.codex/` / `.agents/` as needed for skills, hooks, and MCP |

Lone project-root `AGENTS.md` is **not** a Codex signal (shared compile family with Cursor). Auto-detect MUST NOT create `.codex/` solely to opt in.

## Deploy roots

- `.codex` — agents TOML, hooks.json / scripts, ownership sidecar, `config.toml` MCP
- `.agents` — skills → `.agents/skills/<name>/SKILL.md` (never `.codex/skills/`)
- `.` — compile `AGENTS.md` only (basename allowlist in the compile writer)

## Materialize routing

| Primitive type | Destination                                                                              |
| -------------- | ---------------------------------------------------------------------------------------- |
| skill          | `.agents/skills/<name>/SKILL.md` (+ portable Agent Plugins directory copy)               |
| agent          | `.codex/agents/<name>.toml` (`name` / `description` / `developer_instructions`; drop FM) |
| instruction    | skip (compile-only → `AGENTS.md`)                                                        |
| command/prompt | skip (non-fatal diagnostic)                                                              |
| hook           | merge `.codex/hooks.json` + scripts under `.codex/hooks/` + `.codex/bapm-hooks.json`     |

MCP is **not** written by materialize — only via `configureMcp` → `.codex/config.toml` `mcp_servers` (stdio + https remote; SSE rejected).

## Compile

`compile` defaults to project-root `AGENTS.md`, **includes** instruction primitives, and honors `write` for preview vs durable emit.

Cursor and Codex share the `AGENTS.md` compile family: **last writer wins** per invocation (no merged multi-host document). Prefer a single active compile target when both hosts are registered.

## Dependencies

Depends on `@b-apm/integration-api` and `smol-toml` — not `@b-apm/core`.
Register via `createIntegrationRegistry().register(createCodexIntegration())` or object-map `targets.codex: "@b-apm/integration-codex"`.
