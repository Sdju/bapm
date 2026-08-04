# Compile

Thin cursor-only compile: discover primitives → emit deterministic `AGENTS.md`.

## Public API

- `compileAgentsMd` / `compileProject` / `runCompile` / `emitAgentsMd`
- Options: `validate` (no durable write), `cwd`, `outputFile`

## Non-goals

Does **not** emit `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md`.
