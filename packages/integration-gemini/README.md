# @b-apm/integration-gemini

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Gemini CLI **runtime** host for bapm.

## Detection vs forced target

| Mode                           | When active                                              | Creates roots?                                                    |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| **Auto-detect**                | `.gemini/` **directory** **or** project-root `GEMINI.md` | Only when materialize / configureMcp runs after a positive detect |
| **Forced** (`--target gemini`) | Explicit forced target id, even if detect is false       | MAY `mkdir` `.gemini/` / `.agents/` as needed                     |

Auto-detect without force MUST NOT create `.gemini/` solely for MCP opt-in.

## Deploy roots

- `.gemini` — commands, hooks settings/scripts, ownership sidecar, MCP `settings.json`
- `.agents` — skills under `.agents/skills/`
- `.` — compile `GEMINI.md` only

## Materialize routing

| Primitive type | Destination                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------- |
| skill          | `.agents/skills/<name>/SKILL.md` (never `.gemini/skills/`)                                    |
| command        | `.gemini/commands/<name>.toml` (`prompt` + optional `description`; `$ARGUMENTS` → `{{args}}`) |
| instruction    | not materialized (compile-only diagnostic)                                                    |
| agent          | unsupported non-fatal diagnostic                                                              |
| hook           | merge `.gemini/settings.json` + scripts under `.gemini/hooks/` + `.gemini/bapm-hooks.json`    |

MCP is **not** written by materialize — only via `configureMcp` → `.gemini/settings.json` `mcpServers` when `.gemini/` exists.

## Compile

`compile` defaults to `GEMINI.md`, includes **instruction** primitives only, and honors `write` for preview vs durable emit.

## Object-map

```yaml
targets:
  gemini: "@b-apm/integration-gemini"
active:
  - gemini
```

Depends on `@b-apm/integration-api` (+ `smol-toml`) among dependencies — not `@b-apm/core`.
Exports `createGeminiIntegration` / `createIntegration`.
