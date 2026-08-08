# @bapm/integration-claude

Claude Code **runtime** host for bapm, plus Anthropic **marketplace pack** mapper in the same package.

## Dual surface

| Capability                | Export                                                  | When                                 |
| ------------------------- | ------------------------------------------------------- | ------------------------------------ |
| Runtime install / compile | `createClaudeIntegration` / `createIntegration`         | `targets.claude` / `--target claude` |
| Marketplace pack          | `claudeMarketplaceIntegration` / `mapClaudeMarketplace` | `bapm pack --marketplace claude`     |

Marketplace mapping stays available without activating the runtime factory.

## Detection vs forced target

| Mode                           | When active                                              | Creates roots?                                                    |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| **Auto-detect**                | `.claude/` **directory** **or** project-root `CLAUDE.md` | Only when materialize / configureMcp runs after a positive detect |
| **Forced** (`--target claude`) | Explicit forced target id, even if detect is false       | MAY `mkdir` `.claude/` as needed                                  |

Auto-detect without force MUST NOT create `.claude/` solely for MCP opt-in.

## Deploy roots

- `.claude` — skills, rules, agents, commands, hooks settings/scripts, ownership sidecar
- `.` — project `.mcp.json` and compile `CLAUDE.md` only (basename allowlist in writers)

## Materialize routing

| Primitive type | Destination                                                                                |
| -------------- | ------------------------------------------------------------------------------------------ |
| skill          | `.claude/skills/<name>/SKILL.md` (never `.agents/skills/`)                                 |
| instruction    | `.claude/rules/<name>.md` (`applyTo` → `paths:`)                                           |
| agent          | `.claude/agents/<name>.md`                                                                 |
| command        | `.claude/commands/<name>.md` (shared frontmatter subset)                                   |
| hook           | merge `.claude/settings.json` + scripts under `.claude/hooks/` + `.claude/bapm-hooks.json` |

MCP is **not** written by materialize — only via `configureMcp` → project `.mcp.json` when `.claude/` exists.

## Compile

`compile` defaults to `CLAUDE.md`, omits instruction primitives (they live under `.claude/rules/`), and honors `write` for preview vs durable emit.

## Dependencies

Depends only on `@bapm/integration-api` among bapm packages — not `@bapm/core`.
Register via `createIntegrationRegistry().register(createClaudeIntegration())` or object-map `targets.claude: "@bapm/integration-claude"`.
