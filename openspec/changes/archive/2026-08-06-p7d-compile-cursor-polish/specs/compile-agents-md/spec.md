## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Validate mode does not write
When `--validate` is provided, compile MUST perform discovery and validation checks without durable write of the compile output file (default `AGENTS.md` or the path from `-o` / `--output`). Validate success messaging MUST remain distinct from `--dry-run` would-write preview messaging.

#### Scenario: Validate leaves AGENTS.md untouched
- **WHEN** `bapm compile --validate` runs and `AGENTS.md` is absent or previously unchanged
- **THEN** compile MUST NOT create or rewrite `AGENTS.md` as a durable output

#### Scenario: Validate with custom output does not write that path
- **WHEN** `bapm compile --validate -o nested/OUT.md` runs and `nested/OUT.md` is absent
- **THEN** `nested/OUT.md` MUST remain absent
