## Purpose

Defines thin `bapm compile` for the cursor host: discover project and module primitives and emit a deterministic `AGENTS.md` without multi-host compile adapters or watch mode.

## ADDED Requirements

### Requirement: Compile emits AGENTS.md for cursor
`bapm compile` MUST discover primitives from the project and installed modules (reuse M4 discovery) and MUST emit an `AGENTS.md` at the project root (or documented cursor-relevant path) when compile targets cursor. Default target MUST be cursor or auto-detect cursor. Compile MUST NOT require Copilot/Claude/Gemini target packages or adapters.

#### Scenario: AGENTS.md written from primitives
- **WHEN** the project has discoverable `.apm/` instructions/contexts (or equivalent) and `bapm compile` runs with cursor default
- **THEN** `AGENTS.md` MUST be written and exit code MUST be success

### Requirement: No multi-host compile outputs in M9
Compile MUST NOT create `.claude/`, `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md` as M9 deliverables. Multi-host `--target all` behavior is out of scope.

#### Scenario: Compile does not emit foreign host files
- **WHEN** `bapm compile` succeeds for a cursor project
- **THEN** those foreign-host compile artifacts MUST NOT be created by this command

### Requirement: Deterministic emit when inputs unchanged
The compile emitter MUST order discovered primitives deterministically. When inputs (discovered primitive set and compile options) are unchanged and no volatile fields are included, two consecutive compiles MUST produce an identical `AGENTS.md` body or an identical build-id section (APM build-id spirit).

#### Scenario: Stable body across two compiles
- **WHEN** `bapm compile` runs twice without changing discovered inputs
- **THEN** the emitted `AGENTS.md` content MUST be byte-identical or share an identical build-id section

### Requirement: Validate mode does not write
When `--validate` is provided, compile MUST perform discovery and validation checks without durable write of `AGENTS.md` (SHOULD ship in M9).

#### Scenario: Validate leaves AGENTS.md untouched
- **WHEN** `bapm compile --validate` runs and `AGENTS.md` is absent or previously unchanged
- **THEN** compile MUST NOT create or rewrite `AGENTS.md` as a durable output

### Requirement: Compile stays AGENTS.md-only versus install materialize
Compile MUST NOT be required to refresh `.cursor/rules` or other install materialize paths; those remain install's responsibility. Compile's MUST deliverable is `AGENTS.md` only.

#### Scenario: Compile does not replace rules materialize
- **WHEN** `bapm compile` runs without a prior install materialize of rules
- **THEN** success of compile MUST NOT require writing `.cursor/rules/*.mdc`
