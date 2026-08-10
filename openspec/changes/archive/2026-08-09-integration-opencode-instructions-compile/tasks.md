## 1. Compile runtime

- [x] 1.1 Add `compile` on `createOpencodeIntegration` that renders project-root `AGENTS.md` (basename allowlist), includes instruction primitives, sorts deterministically, and honors write/preview intent (mirror Codex/Cursor pattern)
- [x] 1.2 Keep instruction materialize as non-writing (compile-only); emit a non-fatal skip diagnostic for instructions; leave hooks skip (`OPENCODE_HOOKS_UNSUPPORTED`), detect, MCP, and `.opencode/skills|agents|commands` paths unchanged

## 2. Docs

- [x] 2.1 Update package README for compile → `AGENTS.md` (include instructions) and note last-writer family with Cursor/Codex; keep skills path documented as `.opencode/skills/`
- [x] 2.2 Update user docs (`supported-hosts`, architecture index, compile reference / US-05 as needed) so OpenCode is part of the `AGENTS.md` compile family

## 3. Verification

- [x] 3.1 Acceptance suite under `packages/integration-opencode/tests/acceptance/integration-opencode-instructions-compile/` covering compile write/include-instructions/preview and lone-`AGENTS.md` not detect; keep hooks/MCP regression asserts if needed for RED
- [x] 3.2 After GREEN: promote acceptance into general package tests (e.g. `tests/compile.test.ts` + detect assert); run `vp check` / targeted tests for `@b-apm/integration-opencode`
