## MODIFIED Requirements

### Requirement: No multi-host compile outputs in M9

Cursor-default `bapm compile` MUST NOT create `.claude/`, `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md` as foreign-host side effects. Multi-host `--target all` behavior remains out of scope for this capability. When the active compile target is Claude and `@bapm/integration-claude` exposes `compile`, that host-owned emitter MAY write `CLAUDE.md` (or the compile output path supplied for that target). When the active compile target is Codex and `@bapm/integration-codex` exposes `compile`, that host-owned emitter MAY write project-root `AGENTS.md` (or the compile output path supplied for that target), including instruction primitives. When the active compile target is Copilot and `@bapm/integration-copilot` exposes `compile`, that host-owned emitter MAY write `.github/copilot-instructions.md` (or the compile output path supplied for that target). When the active compile target is Antigravity and `@bapm/integration-antigravity` exposes `compile`, that host-owned emitter MAY write project-root `AGENTS.md` (or the compile output path supplied for that target), omitting instruction primitives already deployed under `.agents/rules/`. Creating `.claude/`, `.codex/`, `.github/`, or `.agents/` trees remains install/materialize’s responsibility except for the host-owned compile output file itself. Cursor, Codex, and Antigravity share the `AGENTS.md` compile family path; concurrent dual-host compiles are last-writer-wins per invocation and MUST NOT invent a merged multi-host document in this capability.

#### Scenario: Compile does not emit foreign host files

- **WHEN** `bapm compile` succeeds for a cursor project / cursor-default selection
- **THEN** those foreign-host compile artifacts (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, and `.claude/` created solely by compile) MUST NOT be created by this command

#### Scenario: Claude-target compile may emit CLAUDE.md

- **WHEN** compile runs with the Claude integration active as the compile target and that integration exposes `compile`
- **THEN** `CLAUDE.md` (or the Claude compile output path) MAY be written by the Claude host emitter and MUST NOT be treated as a forbidden foreign artifact for that run

#### Scenario: Codex-target compile may emit AGENTS.md

- **WHEN** compile runs with the Codex integration active as the compile target and that integration exposes `compile`
- **THEN** `AGENTS.md` (or the Codex compile output path) MAY be written by the Codex host emitter and MUST NOT be treated as a forbidden foreign artifact for that run

#### Scenario: Copilot-target compile may emit copilot-instructions.md

- **WHEN** compile runs with the Copilot integration active as the compile target and that integration exposes `compile`
- **THEN** `.github/copilot-instructions.md` (or the Copilot compile output path) MAY be written by the Copilot host emitter and MUST NOT be treated as a forbidden foreign artifact for that run

#### Scenario: Antigravity-target compile may emit AGENTS.md

- **WHEN** compile runs with the Antigravity integration active as the compile target and that integration exposes `compile`
- **THEN** `AGENTS.md` (or the Antigravity compile output path) MAY be written by the Antigravity host emitter and MUST NOT be treated as a forbidden foreign artifact for that run
