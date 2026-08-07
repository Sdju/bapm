## ADDED Requirements

### Requirement: Compile exposes registered target selection
The CLI `compile` command MUST accept `--target <id>` and `--target=<id>`, forward the selected id to core target orchestration, and document the flag in help. If automatic detection finds zero or multiple registered compile-capable targets, CLI failure output MUST state that `--target <id>` is required. Unknown target ids and targets that lack compile capability MUST fail with a clear error and MUST NOT write compile output.

#### Scenario: Explicit compile target is forwarded
- **WHEN** `runCli(["compile", "--target", "cursor"])` runs with cursor registered
- **THEN** the selected id MUST be forwarded to core compile orchestration and the command MUST use the cursor target capability

#### Scenario: Compile help documents target selection
- **WHEN** `bapm compile --help` runs
- **THEN** help MUST list `--target <id>` and explain that it is required when automatic target detection is absent or ambiguous

#### Scenario: Unknown compile target is rejected
- **WHEN** `runCli(["compile", "--target", "not-a-host"])` is invoked
- **THEN** the command MUST exit non-zero with a clear target error and MUST not write compile output
