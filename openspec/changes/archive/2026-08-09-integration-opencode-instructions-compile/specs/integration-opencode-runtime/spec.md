## ADDED Requirements

### Requirement: Instruction primitives are compile-only for OpenCode

Instruction primitives MUST NOT write OpenCode-native rules/instruction host files during materialize. The integration MUST keep install non-fatal for those primitives and MAY emit a non-fatal diagnostic identifying the skipped kind. Instruction content remains eligible for host `compile` output (`AGENTS.md`).

#### Scenario: Instruction does not materialize native OpenCode rules file

- **WHEN** OpenCode materialize runs with an instruction primitive
- **THEN** no OpenCode-native instruction/rules file MUST be created for that primitive under `.opencode/`
- **AND** install MUST remain non-fatal for that skip alone

### Requirement: Compile emits AGENTS.md including instructions

OpenCode runtime MUST expose `compile` that renders project-root `AGENTS.md` by default (overridable via compile output path context, basename MUST remain `AGENTS.md`). Instruction primitives MUST be included in the compiled body (compile-only guidance path). Emit MUST be deterministic for unchanged inputs. When compile write intent is false, content MUST still be returned without durable write. OpenCode shares the `AGENTS.md` compile family with Cursor and Codex: last writer wins per invocation (no merged multi-host document).

#### Scenario: Compile writes AGENTS.md

- **WHEN** OpenCode `compile` runs with write intent true and discoverable primitives
- **THEN** `AGENTS.md` MUST be written at the project root (or the provided relative output path whose basename is `AGENTS.md`) with deterministic content

#### Scenario: Instructions included in AGENTS.md body

- **WHEN** OpenCode `compile` receives instruction primitives alongside other kinds
- **THEN** the compiled `AGENTS.md` body MUST include those instruction primitives

#### Scenario: Preview does not write AGENTS.md

- **WHEN** OpenCode `compile` runs with write intent false
- **THEN** the report MUST return rendered content and MUST NOT create `AGENTS.md` on disk

#### Scenario: Lone AGENTS.md is not an OpenCode detect signal

- **WHEN** the project has `AGENTS.md` at the project root and neither `.opencode/` nor `opencode.json` / `opencode.jsonc`
- **THEN** OpenCode `detect` MUST return false
