# Compile

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Thin cursor-only compile: discover primitives → emit deterministic `AGENTS.md`.

## Public API

- `compileAgentsMd` / `compileProject` / `runCompile` / `emitAgentsMd`
- Options: `validate` (no durable write), `cwd`, `outputFile`

## Non-goals

Does **not** emit `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md`.
