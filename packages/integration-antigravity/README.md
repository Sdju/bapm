# `@bapm/integration-antigravity`

Antigravity CLI (`agy`) project-scope runtime for bapm.

## Activation (explicit-only)

| Mode                                | Condition                        | Notes                                                                                   |
| ----------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| **Auto-detect**                     | Never                            | `detect` always returns `false` — shared `.agents/` is not an Antigravity-unique signal |
| **Forced** (`--target antigravity`) | Explicit CLI/manifest object-map | MAY `mkdir` `.agents/` for rules/skills/hooks                                           |

Not part of `--target all` alone (same APM model as `agent-skills`). Load via:

```yaml
targets:
  antigravity: "@bapm/integration-antigravity"
```

## Layout

Writes only under `.agents/` (plus project-root `AGENTS.md` compile):

- instructions → `.agents/rules/<name>.md` (`trigger` / `globs` from `applyTo`)
- skills → `.agents/skills/<name>/SKILL.md`
- hooks → `.agents/hooks.json` (agy schema under top-level `bapm`) + `.agents/bapm-hooks.json` sidecar
- MCP → `.agents/mcp_config.json` (**opt-in**: `.agents/` must already exist)
- compile → `AGENTS.md` (omits instruction primitives already deployed as rules)

**Skipped:** agents, commands (APM N).

**Out of scope:** user `~/.gemini/**`; claiming unrelated `.agents/` trees beyond rules/skills/hooks/mcp (coexists with agent-skills skills path).
