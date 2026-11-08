# compile-agents-md Specification

## Purpose

Defines `bapm compile`: discover project and module primitives, select exactly one registered compile-capable target from an explicit `--target`, a sole manifest `active` id, or a sole positive auto-detect, and delegate one instruction-file emission to that target. Every supported host is selected the same way; Cursor is one target, not the compile contract. Child-directory distribution and per-path `applyTo` placement are out of scope.

## Requirements

### Requirement: Compile emits one target-owned instruction file

`bapm compile` MUST discover primitives from the project and installed modules, resolve primitive conflicts, order the surviving primitives deterministically, and delegate emission to exactly one selected registered compile-capable target. Each invocation MUST emit at most one instruction file. Compile MUST use only the selected target's compile capability and MUST NOT require foreign-host adapters or packages to be present. Emitting several host files in one invocation (`--target all`) remains out of scope.

#### Scenario: Selected target writes its instruction file

- **WHEN** the project has discoverable primitives and compile succeeds for a selected compile-capable target
- **THEN** that target's compile capability MUST render and write its instruction file and the command MUST exit `0`

#### Scenario: One invocation does not emit foreign host files

- **WHEN** compile succeeds for the Claude target
- **THEN** `CLAUDE.md` MAY be written by that invocation and compile MUST NOT also create `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, or another target's instruction file

### Requirement: Compile selects an explicit or unambiguous registered target

Compile MUST obtain target detection and compile emission from the registered integration registry. Selection MUST prefer an explicit forced `--target` / forced id when present. Else when the project manifest `active` lists exactly one registered compile-capable integration id, compile MUST select that id without requiring detect. Else without an explicit target, exactly one registered compile-capable integration MUST positively detect the project for compile to proceed. When `active` lists more than one id without an explicit `--target`, or when zero or multiple registered compile-capable integrations are detected and no sole `active` id applies, compile MUST fail with clear guidance to pass `--target <id>` and MUST not write a compile output. An explicit or automatic target MUST be accepted only when it exposes the compile capability.

#### Scenario: Compile automatically selects sole detected target

- **WHEN** `bapm compile` runs without `--target`, without a sole manifest `active` compile id, and exactly one registered compile-capable integration detects the project
- **THEN** compile MUST use that integration's emission capability and succeed according to normal write, validate, or dry-run semantics

#### Scenario: Compile rejects absent or ambiguous automatic selection

- **WHEN** `bapm compile` runs without `--target`, without a sole manifest `active` compile id, and zero or multiple registered compile-capable integrations detect the project
- **THEN** it MUST fail with guidance to pass `--target <id>` and MUST not create or modify compile output

#### Scenario: Sole active selects compile without detect

- **WHEN** `bapm compile` runs without `--target`, `active` contains exactly one registered compile-capable id, and detect is absent
- **THEN** compile MUST use that id's emission capability

#### Scenario: Multi active without target fails compile

- **WHEN** `bapm compile` runs without `--target` and `active` lists two or more ids
- **THEN** compile MUST fail with guidance to pass `--target <id>` and MUST not write compile output

#### Scenario: Forced unregistered or non-compile target fails

- **WHEN** compile runs with `--target <id>` for an id that is unregistered or does not expose compile
- **THEN** compile MUST fail without writing an output file

### Requirement: Compile output layout is owned by the selected target

The selected target's compile capability MUST determine the default output path and render the compile output from the conflict-resolved primitive set. Core MUST retain discovery, conflict resolution, option validation, and no-write orchestration, but MUST NOT derive a host-specific default path itself. Shipped compile-capable targets MUST default to:

- Cursor, Codex, OpenCode, Kiro, Grok Build, and Antigravity: project-root `AGENTS.md`
- Claude: project-root `CLAUDE.md`
- Gemini: project-root `GEMINI.md`
- Copilot: `.github/copilot-instructions.md`

Windsurf does not expose compile and MUST be rejected as a compile target. Compile MUST NOT merge several hosts into one document; Cursor, Codex, OpenCode, Kiro, Grok Build, and Antigravity share `AGENTS.md`, so separate invocations for those hosts are last-writer-wins.

#### Scenario: Target controls default compile output

- **WHEN** compile succeeds for a selected target without an output override
- **THEN** the reported output path and content MUST be supplied by that target capability rather than a core default

#### Scenario: AGENTS family host writes project-root AGENTS.md

- **WHEN** compile selects Cursor, Codex, OpenCode, Kiro, Grok Build, or Antigravity and no `-o` / `--output` is supplied
- **THEN** `AGENTS.md` at the project root MUST be the reported and written path

#### Scenario: Claude and Gemini use their own default names

- **WHEN** compile selects Claude or Gemini without an output override
- **THEN** Claude MUST default to `CLAUDE.md` and Gemini MUST default to `GEMINI.md`

#### Scenario: Copilot uses its instructions path

- **WHEN** compile selects Copilot without an output override
- **THEN** the default output MUST be `.github/copilot-instructions.md`

#### Scenario: Shared AGENTS.md is not merged across hosts

- **WHEN** compile runs for Cursor and later for another AGENTS-family host in separate invocations
- **THEN** the later invocation MUST overwrite `AGENTS.md` and MUST NOT preserve a merged document from both hosts

#### Scenario: Windsurf cannot be a compile target

- **WHEN** compile runs with `--target windsurf`
- **THEN** compile MUST fail because the target does not expose the compile capability

### Requirement: Compile accepts output path flag

`bapm compile` MUST accept `-o` / `--output PATH` and MUST write the compiled instruction file to that path relative to the project cwd when neither `--validate` nor `--dry-run` applies. When `-o` / `--output` is omitted, the default output MUST be the selected target's default path. Parent directories for the output path MUST be created when missing. Paths outside cwd are invalid. A target MAY require a fixed basename: shipped Codex, OpenCode, and Grok Build targets require `AGENTS.md`, and Gemini requires `GEMINI.md`.

#### Scenario: Custom output path writes only that file

- **WHEN** `bapm compile -o nested/OUT.md` runs successfully in a project with discoverable primitives
- **THEN** exit code MUST be `0`, `nested/OUT.md` MUST exist with compiled content, and the target's default output MUST NOT be created by that run

#### Scenario: Default output is target-owned

- **WHEN** `bapm compile` runs successfully for a selected target without `-o` / `--output`
- **THEN** the selected target's default path MUST be written at the project root or target-relative path documented for that host

#### Scenario: Target-enforced basename rejects another name

- **WHEN** compile runs for Codex, OpenCode, or Grok Build with an output basename other than `AGENTS.md`, or for Gemini with a basename other than `GEMINI.md`
- **THEN** compile MUST fail without writing the output file

#### Scenario: Output outside cwd is rejected

- **WHEN** compile is given `-o ../OUT.md` or another cwd-escaping path
- **THEN** compile MUST fail without writing outside the project cwd

### Requirement: Deterministic emit when inputs unchanged

The compile emitter MUST order discovered primitives deterministically. When inputs (discovered primitive set and compile options) are unchanged and no volatile fields are included, two consecutive compiles MUST produce an identical instruction-file body or an identical build-id section (APM build-id spirit).

#### Scenario: Stable body across two compiles

- **WHEN** `bapm compile` runs twice without changing discovered inputs
- **THEN** the emitted instruction-file content MUST be byte-identical or share an identical build-id section

### Requirement: Validate mode does not write

When `--validate` is provided, compile MUST perform discovery and validation checks without durable write of the compile output file (the selected target's default or the path from `-o` / `--output`). Validate success messaging MUST remain distinct from `--dry-run` would-write preview messaging.

#### Scenario: Validate leaves the default output untouched

- **WHEN** `bapm compile --validate` runs and the selected target's default output is absent or previously unchanged
- **THEN** compile MUST NOT create or rewrite that output as a durable result

#### Scenario: Validate with custom output does not write that path

- **WHEN** `bapm compile --validate -o nested/OUT.md` runs and `nested/OUT.md` is absent
- **THEN** `nested/OUT.md` MUST remain absent

### Requirement: Dry-run previews without write

When `--dry-run` is provided (and `--validate` is not), compile MUST discover and render as for a normal compile, MUST print a would-write preview that includes the intended output path and primitives count, MUST NOT create or rewrite the output file (the selected target's default or `-o` path), and MUST exit `0` on success. The dry-run success message MUST be observably distinct from the `--validate` success message.

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

When `-v` / `--verbose` is provided on a successful compile or dry-run path, the CLI MUST emit thin source attribution for discovered primitives including at least each primitive's name and type, and path when known. Verbose output MUST NOT claim multi-host optimizer analysis or distributed placement.

#### Scenario: Verbose lists name type and path

- **WHEN** `bapm compile -v` (or `--verbose`) succeeds against a fixture with at least one discoverable primitive that has a known path
- **THEN** stdout MUST include that primitive's name, type, and path (or an equivalent thin attribution line covering those fields)

### Requirement: Core compile options support target selection, dry-run, and verbose

`@b-apm/core` compile orchestration MUST accept options equivalent to `forcedTarget`, an integration registry (or registered target factory), `dryRun`, and `verbose` (in addition to existing `validate` and `outputFile`) so target selection and no-write preview are not CLI-only side effects. When `dryRun` is true and `validate` is false, core MUST compute content and MUST set `wrote` false without durable write. When `validate` is true, core MUST NOT write regardless of `dryRun`.

#### Scenario: Core dryRun does not write

- **WHEN** core compile is invoked with `dryRun: true` and `validate: false`
- **THEN** the result MUST report `wrote: false` and the output path on disk MUST not be created or rewritten by that call

#### Scenario: Core forced target bypasses detection

- **WHEN** core compile is invoked with a registered `forcedTarget`
- **THEN** it MUST use that target's compile capability without consulting manifest `active` or auto-detect

### Requirement: Compile does not replace install materialize

Compile MUST NOT be required to refresh host install materialize trees such as rules, skills, agents, commands, or hooks; those remain install's responsibility. Compile's deliverable is one instruction file for the selected target.

#### Scenario: Compile does not write host materialize trees

- **WHEN** `bapm compile` runs without a prior install materialize of rules
- **THEN** compile MUST NOT create or update a host rules tree such as `.cursor/rules/`, `.claude/rules/`, or `.kiro/steering/`

### Requirement: Compile emits one file and does not interpret applyTo placement

Compile MUST render the selected primitives into a single instruction file. It MUST NOT distribute primitives across per-path outputs or interpret instruction `applyTo` / glob placement for compile output; a target MAY omit primitives already materialized as host rules, but it MUST NOT create a separate file per `applyTo` path.

#### Scenario: Instruction with applyTo stays in the single output

- **WHEN** a discovered instruction primitive declares `applyTo` patterns and compile runs for the selected target
- **THEN** compile MUST write its one instruction file and MUST NOT create per-pattern or per-directory compile outputs

## Tech debt (APM parity — not claimed)

Thin single-target, single-file compile is **intentional**. Gaps vs microsoft/apm `apm compile` / `AgentsCompiler` are tracked as product tech debt (not silent omissions, not OpenAPM MUST failures). Canonical IDs: `.samples/apm-knowledge/topics/tech-debt-compile.md`.

| ID            | Gap                                                       | Status                 |
| ------------- | --------------------------------------------------------- | ---------------------- |
| TD-COMPILE-01 | Emit all primitives vs APM instructions-only              | debt                   |
| TD-COMPILE-02 | No per-path `applyTo` / glob placement (single-file only) | debt                   |
| TD-COMPILE-03 | No markdown link inline / `--no-links`                    | debt (SHOULD deferred) |
| TD-COMPILE-05 | Missing APM UX flags (watch/clean/global/…)               | debt                   |
| TD-COMPILE-06 | No deterministic Build ID / Unicode write gate            | debt                   |
| TD-COMPILE-07 | Thinner `--validate` than APM                             | debt                   |
| TD-COMPILE-08 | Flat `## name (type)` vs APM template sections            | debt                   |

Closing a `debt` row REQUIRES a dedicated OpenSpec change that updates this section and the knowledge inventory. Specs MUST NOT claim APM AgentsCompiler parity while these rows remain open.
