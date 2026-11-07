## MODIFIED Requirements

### Requirement: Compile exposes registered target selection

The CLI `compile` command MUST accept `--target <id>` and `--target=<id>`, forward the selected id to core target orchestration, and document the flag in help. If automatic detection finds zero or multiple registered compile-capable targets and the manifest does not supply a sole `active` compile-capable id, CLI failure output MUST state that `--target <id>` is required (and MAY mention `active`). Unknown target ids and targets that lack compile capability MUST fail with a clear error and MUST NOT write compile output. Registration for unknown-id checks MUST include integrations loaded from the manifest object-map when present (`target-integration-dynamic-load`). When `active` lists multiple ids without `--target`, compile MUST fail closed asking for `--target <id>`. Help MUST NOT claim built-in Cursor registration.

#### Scenario: Explicit compile target is forwarded

- **WHEN** `runCli(["compile", "--target", "cursor"])` runs with cursor registered via object-map
- **THEN** the selected id MUST be forwarded to core compile orchestration and the command MUST use the cursor target capability

#### Scenario: Compile help documents target selection

- **WHEN** `bapm compile --help` runs
- **THEN** help MUST list `--target <id>` and explain that it is required when automatic target detection is absent or ambiguous (and when multi-`active` needs a force)

#### Scenario: Unknown compile target is rejected

- **WHEN** `runCli(["compile", "--target", "not-a-host"])` is invoked and no map binding registers that id
- **THEN** the command MUST exit non-zero with a clear target error and MUST not write compile output

#### Scenario: Map-bound compile target is accepted

- **WHEN** `runCli(["compile", "--target", "x-acme-editor"])` runs after object-map load registered a compile-capable `x-acme-editor` integration
- **THEN** compile MUST forward that id and MUST NOT treat it as an unknown target solely because no built-in registry entry exists

#### Scenario: Sole manifest active selects compile without --target

- **WHEN** `runCli(["compile"])` runs with `active: { target: cursor }`, cursor registered by an object-map or resolvable canonical package and compile-capable, and detect absent
- **THEN** compile MUST select cursor without requiring `--target`
