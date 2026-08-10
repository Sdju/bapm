# @b-apm/integration-grok-build

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Grok Build **runtime** host for bapm (APM `KNOWN_TARGETS["grok-build"]`).

## Detection vs forced target

| Mode                               | When active                 | Creates roots?                                     |
| ---------------------------------- | --------------------------- | -------------------------------------------------- |
| **Auto-detect**                    | `.grok/` **directory** only | Only when materialize runs after a positive detect |
| **Forced** (`--target grok-build`) | Explicit forced target id   | MAY `mkdir` `.grok/` as needed                     |

Auto-detect without force MUST NOT create `.grok/` solely to opt in. Lone `AGENTS.md` is **not** a Grok Build signal.

## Deploy roots

- `.grok` — rules, agents, commands, skills
- `.` — project compile `AGENTS.md` only (basename allowlist in compile writer)

## Materialize routing

| Primitive type | Destination                                              |
| -------------- | -------------------------------------------------------- |
| skill          | `.grok/skills/<name>/SKILL.md` (never `.agents/skills/`) |
| instruction    | `.grok/rules/<name>.md` (verbatim)                       |
| agent          | `.grok/agents/<name>.md`                                 |
| command        | `.grok/commands/<name>.md` (Claude-subset frontmatter)   |
| hook / prompt  | skip + non-fatal diagnostic                              |

**No** `configureMcp` (APM matrix: MCP unsupported). Experimental **grok-cloud** is out of scope.

## Compile

`compile` defaults to project-root `AGENTS.md` (agents compile family; last-writer vs Cursor/Codex) and honors `write` for preview vs durable emit.

## Dependencies

Depends only on `@b-apm/integration-api` among bapm packages — not `@b-apm/core`.
Register via object-map:

```yaml
targets:
  grok-build: "@b-apm/integration-grok-build"
active:
  - grok-build
```
