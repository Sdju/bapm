## ADDED Requirements

### Requirement: Compile selects an explicit or unambiguous registered target

Compile MUST obtain target detection and compile emission from the registered target registry. Without an explicit target, exactly one registered compile-capable target MUST positively detect the project for compile to proceed. When zero or multiple registered targets are detected, compile MUST fail with clear guidance to pass `--target <id>` and MUST not write a compile output. An explicit registered target MUST be accepted only when it exposes the compile capability.

#### Scenario: Compile automatically selects sole detected target

- **WHEN** `bapm compile` runs without `--target` and exactly one registered compile-capable target detects the project
- **THEN** compile MUST use that target's emission capability and succeed according to normal write, validate, or dry-run semantics

#### Scenario: Compile rejects absent or ambiguous automatic selection

- **WHEN** `bapm compile` runs without `--target` and zero or multiple registered compile-capable targets detect the project
- **THEN** it MUST fail with guidance to pass `--target <id>` and MUST not create or modify compile output

### Requirement: Compile output layout is owned by the selected target

The selected target's compile capability MUST determine the default output path and render the compile output from the conflict-resolved primitive set. Core MUST retain discovery, conflict resolution, option validation, and no-write orchestration, but MUST NOT render `AGENTS.md` or derive a Cursor-specific default path itself. An explicit `-o` / `--output` override MUST be passed through the target contract subject to existing cwd-relative output semantics.

#### Scenario: Target controls default compile output

- **WHEN** compile succeeds for a selected target without an output override
- **THEN** the reported output path and content MUST be supplied by that target capability rather than a Cursor-specific core implementation

#### Scenario: Output override reaches selected target

- **WHEN** compile succeeds with `-o nested/OUT.md` for a selected compile-capable target
- **THEN** the target MUST receive the cwd-relative override and no default output path MUST be written by core
