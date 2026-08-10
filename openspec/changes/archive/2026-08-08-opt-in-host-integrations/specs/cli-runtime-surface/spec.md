## MODIFIED Requirements

### Requirement: Install command runs core install happy path

Invoking `install` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@b-apm/core` install orchestration (not a permanent not-implemented stub). On a valid project fixture happy path it MUST exit `0` with modules and lock present; when a cursor target is wired via object-map registration and detect/force/`active` applies, deploy files under registered roots MAY/MUST appear per cursor and install-pipeline specs. The command MUST accept `--frozen` and `--no-frozen`, MUST apply CI-default frozen per the CI opt-out requirement, and MUST mirror core frozen failure/success semantics including deployed-hash re-verify when hashes exist whenever effective frozen is on. The command MUST hard-reject unknown flags and MUST reject effective frozen combined with mutation flags such as `--update` when exposed. The CLI distribution MUST NOT hard-depend on `@b-apm/integration-cursor` for eager registration; fixtures that need Cursor MUST register it via object-map load of a resolvable package. `@b-apm/core` MUST NOT import that package.

#### Scenario: bapm install happy path

- **WHEN** `runCli(["install"])` is invoked in a valid project fixture with resolvable deps
- **THEN** the exit code MUST be `0`, modules and lock MUST exist, and if cursor is registered via map and active, deploy files under registered roots MAY be present

#### Scenario: bapm install --frozen mirrors core gate

- **WHEN** `runCli(["install", "--frozen"])` is invoked
- **THEN** behavior MUST match core frozen rules (fail before mutation when lock absent or direct pin missing; no lock rewrite on success; re-verify `deployed_file_hashes` when present)

#### Scenario: install is not an unknown command

- **WHEN** `runCli(["install"])` is called
- **THEN** the CLI MUST NOT treat `install` as an unknown command

#### Scenario: frozen plus update rejected at CLI

- **WHEN** `runCli(["install", "--frozen", "--update"])` is called
- **THEN** the return code MUST be non-zero and no install mutation MUST occur

### Requirement: Install supports target flag with clear rejection

The install command MUST accept `--target <id>` (or an equivalent documented form). When `<id>` is registered as an integration successfully loaded from the manifest object-map, install MUST pass forced-target activation into core and that force MUST override manifest `active` for the run. When `<id>` is unknown/unregistered after map loading (with no eager built-in hosts), install MUST fail with a clear error. Help for install MUST document `--target` as the forced override and MUST note that a non-empty manifest `active` list may select hosts when `--target` is omitted. Help MUST NOT claim that Cursor or other hosts are built into the CLI.

#### Scenario: Target cursor forces activation

- **WHEN** `runCli(["install", "--target", "cursor"])` runs in a valid fixture with cursor registered via object-map
- **THEN** core install MUST receive forced target `cursor` and the process MUST follow forced-target deploy rules from `install-pipeline`

#### Scenario: Unknown target id rejected

- **WHEN** `runCli(["install", "--target", "not-a-host"])` is called and no map binding registers that id
- **THEN** the return code MUST be non-zero and stderr MUST clearly reject the unknown target

#### Scenario: Map-bound custom target accepted

- **WHEN** `runCli(["install", "--target", "x-acme-editor"])` runs after a successful object-map load that registered `x-acme-editor`
- **THEN** install MUST pass forced target `x-acme-editor` into core rather than rejecting the id as unregistered

#### Scenario: Install without --target uses manifest active

- **WHEN** `runCli(["install"])` runs in a fixture whose manifest has a non-empty registered `active` list and no `--target`
- **THEN** core MUST activate those ids per `manifest-active-targets` / `install-pipeline` without requiring detect

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

- **WHEN** `runCli(["compile"])` runs with `active: [cursor]`, cursor registered via object-map and compile-capable, and detect absent
- **THEN** compile MUST select cursor without requiring `--target`

### Requirement: Install and compile load manifest integration map before core

When the project manifest uses object-map `target` / `targets`, the CLI `install` and `compile` composition paths MUST apply `target-integration-dynamic-load` (resolve, validate, register) against the CLI integration registry before invoking `@b-apm/core` install or compile orchestration. The registry MUST start without eagerly registered built-in hosts. Map values MAY be npm package specifiers or local filesystem paths as defined by that capability. Legacy string/array manifests MUST NOT receive built-in-only host registration; without an object-map, no concrete host integrations are registered by the composition root. Help text MAY mention that object-map bindings load integration packages or local modules; it MUST continue to document `--target <id>` as the forced-host selector and MUST NOT claim that map keys alone activate hosts when `active` is absent. Help MUST NOT claim Cursor ships built into the CLI.

#### Scenario: Install loads map then forces custom target

- **WHEN** `runCli(["install", "--target", "x-acme-editor"])` runs in a project whose object-map binds `x-acme-editor` to a resolvable valid runtime integration package
- **THEN** the exit path MUST NOT fail with “unknown or unregistered target” solely because the id was absent before map load, and materialize MUST be able to proceed through the loaded integration when other install preconditions pass

#### Scenario: Install loads local-path map then forces custom target

- **WHEN** `runCli(["install", "--target", "pi"])` runs in a project whose object-map binds `pi` to a resolvable in-root local path exporting a valid runtime integration
- **THEN** the exit path MUST NOT fail with “unknown or unregistered target” solely because the id was absent before map load, and materialize MUST be able to proceed through the loaded integration when other install preconditions pass

#### Scenario: Compile loads map then forces custom target

- **WHEN** `runCli(["compile", "--target", "x-acme-editor"])` runs with the same valid object-map binding and the loaded integration exposes compile capability
- **THEN** compile MUST select that registered integration rather than failing as an unknown target id

#### Scenario: Install unknown target after map still fails

- **WHEN** `runCli(["install", "--target", "not-a-host"])` runs and the id is not present as a successful map binding
- **THEN** the return code MUST be non-zero with a clear unknown/unregistered target diagnostic

#### Scenario: Cursor without map is unknown

- **WHEN** `runCli(["install", "--target", "cursor"])` runs without a successful object-map binding for `cursor`
- **THEN** the return code MUST be non-zero with an unknown/unregistered target diagnostic for `cursor`
