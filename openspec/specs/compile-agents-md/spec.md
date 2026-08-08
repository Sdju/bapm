# compile-agents-md Specification

## Purpose

Defines thin `bapm compile` for the cursor host: discover project and module primitives and emit a deterministic `AGENTS.md` without multi-host compile adapters or watch mode.

## Requirements

### Requirement: Compile emits AGENTS.md for cursor

`bapm compile` MUST discover primitives from the project and installed modules (reuse M4 discovery) and MUST emit an `AGENTS.md` at the project root (or documented cursor-relevant path) when compile targets cursor. Default target MUST be cursor or auto-detect cursor. Compile MUST NOT require Copilot/Claude/Gemini target packages or adapters.

#### Scenario: AGENTS.md written from primitives

- **WHEN** the project has discoverable `.apm/` instructions/contexts (or equivalent) and `bapm compile` runs with cursor default
- **THEN** `AGENTS.md` MUST be written and exit code MUST be success

### Requirement: No multi-host compile outputs in M9

Cursor-default `bapm compile` MUST NOT create `.claude/`, `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md` as foreign-host side effects. Multi-host `--target all` behavior remains out of scope for this capability. When the active compile target is Claude and `@bapm/integration-claude` exposes `compile`, that host-owned emitter MAY write `CLAUDE.md` (or the compile output path supplied for that target). When the active compile target is Codex and `@bapm/integration-codex` exposes `compile`, that host-owned emitter MAY write project-root `AGENTS.md` (or the compile output path supplied for that target), including instruction primitives. Creating `.claude/` or `.codex/` trees remains install/materialize’s responsibility, not cursor-default compile. Cursor and Codex share the `AGENTS.md` compile family path; concurrent dual-host compiles are last-writer-wins per invocation and MUST NOT invent a merged multi-host document in this capability.

#### Scenario: Compile does not emit foreign host files

- **WHEN** `bapm compile` succeeds for a cursor project / cursor-default selection
- **THEN** those foreign-host compile artifacts (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, and `.claude/` created solely by compile) MUST NOT be created by this command

#### Scenario: Claude-target compile may emit CLAUDE.md

- **WHEN** compile runs with the Claude integration active as the compile target and that integration exposes `compile`
- **THEN** `CLAUDE.md` (or the Claude compile output path) MAY be written by the Claude host emitter and MUST NOT be treated as a forbidden foreign artifact for that run

#### Scenario: Codex-target compile may emit AGENTS.md

- **WHEN** compile runs with the Codex integration active as the compile target and that integration exposes `compile`
- **THEN** `AGENTS.md` (or the Codex compile output path) MAY be written by the Codex host emitter and MUST NOT be treated as a forbidden foreign artifact for that run

### Requirement: Deterministic emit when inputs unchanged

The compile emitter MUST order discovered primitives deterministically. When inputs (discovered primitive set and compile options) are unchanged and no volatile fields are included, two consecutive compiles MUST produce an identical `AGENTS.md` body or an identical build-id section (APM build-id spirit).

#### Scenario: Stable body across two compiles

- **WHEN** `bapm compile` runs twice without changing discovered inputs
- **THEN** the emitted `AGENTS.md` content MUST be byte-identical or share an identical build-id section

### Requirement: Validate mode does not write

When `--validate` is provided, compile MUST perform discovery and validation checks without durable write of the compile output file (default `AGENTS.md` or the path from `-o` / `--output`). Validate success messaging MUST remain distinct from `--dry-run` would-write preview messaging.

#### Scenario: Validate leaves AGENTS.md untouched

- **WHEN** `bapm compile --validate` runs and `AGENTS.md` is absent or previously unchanged
- **THEN** compile MUST NOT create or rewrite `AGENTS.md` as a durable output

#### Scenario: Validate with custom output does not write that path

- **WHEN** `bapm compile --validate -o nested/OUT.md` runs and `nested/OUT.md` is absent
- **THEN** `nested/OUT.md` MUST remain absent

### Requirement: Compile accepts output path flag

`bapm compile` MUST accept `-o` / `--output PATH` and MUST write the compiled agents file to that path relative to the project cwd when neither `--validate` nor `--dry-run` applies. When `-o` / `--output` is omitted, the default output MUST remain `AGENTS.md`. Parent directories for the output path MUST be created when missing (same behavior as today's default write). Absolute-path expansion outside cwd is out of scope; path resolution MUST use project-cwd join semantics.

#### Scenario: Custom output path writes only that file

- **WHEN** `bapm compile -o nested/OUT.md` runs successfully in a project with discoverable primitives
- **THEN** exit code MUST be `0`, `nested/OUT.md` MUST exist with compiled content, and default `AGENTS.md` MUST NOT be created by that run

#### Scenario: Default output remains AGENTS.md

- **WHEN** `bapm compile` runs successfully without `-o` / `--output`
- **THEN** `AGENTS.md` MUST be written at the project root (cwd)

### Requirement: Dry-run previews without write

When `--dry-run` is provided (and `--validate` is not), compile MUST discover and render as for a normal compile, MUST print a would-write preview that includes the intended output path and primitives count, MUST NOT create or rewrite the output file (default `AGENTS.md` or `-o` path), and MUST exit `0` on success. The dry-run success message MUST be observably distinct from the `--validate` success message.

#### Scenario: Dry-run leaves output absent

- **WHEN** `bapm compile --dry-run` runs and the output file is absent
- **THEN** exit code MUST be `0`, stdout MUST mention the would-write path and a primitives count, and the output file MUST still be absent

#### Scenario: Dry-run does not rewrite existing output

- **WHEN** an output file already exists and `bapm compile --dry-run` runs
- **THEN** the output file content MUST be unchanged

### Requirement: Validate-first when combined with dry-run

When both `--validate` and `--dry-run` are set, compile MUST follow validate-first semantics (APM early-return): perform discovery/validation only, MUST NOT write, MUST NOT use dry-run would-write messaging as the primary success message, and MUST exit `0` on success with a validate-style message.

#### Scenario: Both flags prefer validate messaging and no write

- **WHEN** `bapm compile --validate --dry-run` runs and the output file is absent
- **THEN** exit code MUST be `0`, the output file MUST remain absent, and stdout MUST match validate-style messaging (not dry-run would-write as the sole/primary success line)

### Requirement: Verbose emits thin source attribution

When `-v` / `--verbose` is provided on a successful compile or dry-run path, the CLI MUST emit thin source attribution for discovered primitives including at least each primitive's name and type, and path when known. Verbose output MUST NOT claim multi-host optimizer analysis, distributed placement, or foreign-host compile targets.

#### Scenario: Verbose lists name type and path

- **WHEN** `bapm compile -v` (or `--verbose`) succeeds against a fixture with at least one discoverable primitive that has a known path
- **THEN** stdout MUST include that primitive's name, type, and path (or an equivalent thin attribution line covering those fields)

### Requirement: Core compile options support dry-run and verbose

`@bapm/core` compile orchestration MUST accept options equivalent to `dryRun` and `verbose` (in addition to existing `validate` and `outputFile`) so no-write preview and attribution are not CLI-only side effects. When `dryRun` is true and `validate` is false, core MUST compute content and MUST set `wrote` false without durable write. When `validate` is true, core MUST NOT write regardless of `dryRun`.

#### Scenario: Core dryRun does not write

- **WHEN** core compile is invoked with `dryRun: true` and `validate: false`
- **THEN** the result MUST report `wrote: false` and the output path on disk MUST not be created or rewritten by that call

### Requirement: Compile stays AGENTS.md-only versus install materialize

Compile MUST NOT be required to refresh `.cursor/rules` or other install materialize paths; those remain install's responsibility. Compile's MUST deliverable is `AGENTS.md` only.

#### Scenario: Compile does not replace rules materialize

- **WHEN** `bapm compile` runs without a prior install materialize of rules
- **THEN** success of compile MUST NOT require writing `.cursor/rules/*.mdc`

### Requirement: Compile selects an explicit or unambiguous registered target

Compile MUST obtain target detection and compile emission from the registered integration registry. Selection MUST prefer an explicit forced `--target` / forced id when present. Else when the project manifest `active` lists exactly one registered compile-capable integration id, compile MUST select that id without requiring detect. Else without an explicit target, exactly one registered compile-capable integration MUST positively detect the project for compile to proceed. When `active` lists more than one id without an explicit `--target`, or when zero or multiple registered integrations are detected and no sole `active` id applies, compile MUST fail with clear guidance to pass `--target <id>` and MUST not write a compile output. An explicit registered target MUST be accepted only when it exposes the compile capability.

#### Scenario: Compile automatically selects sole detected target

- **WHEN** `bapm compile` runs without `--target`, without a sole manifest `active` compile id, and exactly one registered compile-capable integration detects the project
- **THEN** compile MUST use that integration's emission capability and succeed according to normal write, validate, or dry-run semantics

#### Scenario: Compile rejects absent or ambiguous automatic selection

- **WHEN** `bapm compile` runs without `--target`, without a sole manifest `active` compile id, and zero or multiple registered compile-capable integrations detect the project
- **THEN** it MUST fail with guidance to pass `--target <id>` and MUST not create or modify compile output

#### Scenario: Sole active selects compile without detect

- **WHEN** `bapm compile` runs without `--target`, `active` contains exactly one registered compile-capable id, and detect is absent
- **THEN** compile MUST use that id’s emission capability

#### Scenario: Multi active without force fails compile

- **WHEN** `bapm compile` runs without `--target` and `active` lists two or more ids
- **THEN** compile MUST fail with guidance to pass `--target <id>` and MUST not write compile output

### Requirement: Compile output layout is owned by the selected target

The selected target's compile capability MUST determine the default output path and render the compile output from the conflict-resolved primitive set. Core MUST retain discovery, conflict resolution, option validation, and no-write orchestration, but MUST NOT render `AGENTS.md` or derive a Cursor-specific default path itself. An explicit `-o` / `--output` override MUST be passed through the target contract subject to existing cwd-relative output semantics.

#### Scenario: Target controls default compile output

- **WHEN** compile succeeds for a selected target without an output override
- **THEN** the reported output path and content MUST be supplied by that target capability rather than a Cursor-specific core implementation

#### Scenario: Output override reaches selected target

- **WHEN** compile succeeds with `-o nested/OUT.md` for a selected compile-capable target
- **THEN** the target MUST receive the cwd-relative override and no default output path MUST be written by core

## Tech debt (APM parity — not claimed)

Thin Cursor compile is **intentional**. Gaps vs microsoft/apm `apm compile` / `AgentsCompiler` are tracked as product tech debt (not silent omissions, not OpenAPM MUST failures). Canonical IDs: `.samples/apm-knowledge/topics/tech-debt-compile.md`.

| ID            | Gap                                                     | Status                 |
| ------------- | ------------------------------------------------------- | ---------------------- |
| TD-COMPILE-01 | Emit all primitives vs APM instructions-only            | debt                   |
| TD-COMPILE-02 | No distributed / `applyTo` placement (single-file only) | debt                   |
| TD-COMPILE-03 | No markdown link inline / `--no-links`                  | debt (SHOULD deferred) |
| TD-COMPILE-04 | No multi-host compile outputs                           | accept (freeze)        |
| TD-COMPILE-05 | Missing APM UX flags (watch/clean/global/…)             | debt                   |
| TD-COMPILE-06 | No deterministic Build ID / Unicode write gate          | debt                   |
| TD-COMPILE-07 | Thinner `--validate` than APM                           | debt                   |
| TD-COMPILE-08 | Flat `## name (type)` vs APM template sections          | debt                   |

Closing a `debt` row REQUIRES a dedicated OpenSpec change that updates this section and the knowledge inventory. Specs MUST NOT claim APM AgentsCompiler parity while these rows remain open.
