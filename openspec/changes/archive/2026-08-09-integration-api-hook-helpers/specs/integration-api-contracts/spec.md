## ADDED Requirements

### Requirement: HookOwnershipSidecar type and read/write helpers

`@bapm/integration-api` MUST export a `HookOwnershipSidecar` type describing a document with an `owned` map whose values MAY include optional `packageName`, `entries` (event/command pairs), `scripts` (cwd-relative paths), `hookFile` (single cwd-relative path), and/or `hookFiles` (cwd-relative paths). The package MUST export `readHookOwnershipSidecar` and `writeHookOwnershipSidecar` for that document shape. Read MUST return `{ owned: {} }` when the path is missing, unreadable, or not an object with an `owned` object. Write MUST serialize `{ owned }` as JSON (pretty-printed with trailing newline consistent with other helpers) after the caller has already asserted deploy-root containment for the sidecar path.

#### Scenario: Missing sidecar reads as empty owned

- **WHEN** `readHookOwnershipSidecar` is called for a path that does not exist
- **THEN** the result MUST be `{ owned: {} }`

#### Scenario: Malformed sidecar reads as empty owned

- **WHEN** the file exists but JSON is invalid or lacks an object `owned` field
- **THEN** `readHookOwnershipSidecar` MUST return `{ owned: {} }` without throwing

#### Scenario: Write round-trips owned records with mixed fields

- **WHEN** a caller writes a sidecar whose owned records include a mix of `entries`/`scripts` and `hookFile`/`hookFiles`
- **THEN** a subsequent read of that path MUST preserve those optional fields for the written keys

### Requirement: stripOwnedHookCommands helper

`@bapm/integration-api` MUST export `stripOwnedHookCommands` that, given a host hooks object (event → array of entries with optional `command` string) and a `HookOwnershipSidecar`, removes every entry whose `command` appears in any owned record's `entries`. Non-array event values MUST be left unchanged. The helper MUST NOT delete script files or hook JSON files from disk.

#### Scenario: Owned commands removed; unrelated kept

- **WHEN** hooks contain owned and non-owned command entries for an event and the sidecar lists the owned commands
- **THEN** only entries whose command matches an owned entry command MUST be removed from that event's array

#### Scenario: Empty ownership is a no-op

- **WHEN** the sidecar has no owned entry commands
- **THEN** the hooks object MUST remain unchanged

### Requirement: removeOwnedHookArtifacts helper

`@bapm/integration-api` MUST export `removeOwnedHookArtifacts` that best-effort deletes, under the given `cwd`, every path listed in owned records' `scripts`, optional `hookFile`, and optional `hookFiles`. Missing paths MUST be ignored. The helper MUST NOT mutate host hooks JSON and MUST NOT throw solely because a listed path is already absent.

#### Scenario: Removes scripts and hook files listed in sidecar

- **WHEN** the sidecar lists script paths and either `hookFile` or `hookFiles` that exist under `cwd`
- **THEN** those files MUST be deleted after the call

#### Scenario: Missing paths ignored

- **WHEN** a listed script or hook path does not exist
- **THEN** the helper MUST continue without throwing for that path

### Requirement: Simple copyHookScript helper

`@bapm/integration-api` MUST export a simple `copyHookScript` helper for hosts that resolve a script next to the hook source or under `findPackageRoot(hookFile)`, copy it to a caller-supplied cwd-relative `destRel` under deploy roots, and return a rewritten command path. Arguments MUST include at least `cwd`, `deployRoots`, `hookFile`, `command`, `alreadyDeployedNeedle`, and `destRel`, plus an optional flag controlling whether the returned command uses a `./` prefix. When `command` already contains `alreadyDeployedNeedle`, the helper MUST NOT copy and MUST return a normalized command path. When no candidate source file exists, it MUST return the original `command` unchanged. Successful copy MUST assert deploy-root containment, create parent directories, copy the file, and return `{ commandRel, scriptRel }` with `scriptRel` equal to `destRel`.

#### Scenario: Copy under deploy roots and rewrite command

- **WHEN** `command` points at an existing script relative to the hook file and does not contain `alreadyDeployedNeedle`
- **THEN** the helper MUST copy the script to `destRel`, pass deploy-root checks, and return a command relative path referencing that destination plus `scriptRel: destRel`

#### Scenario: Already-deployed needle skips copy

- **WHEN** `command` includes `alreadyDeployedNeedle`
- **THEN** the helper MUST NOT copy a file and MUST return a command path without inventing a new `scriptRel`

#### Scenario: Missing source keeps original command

- **WHEN** no candidate file exists for `command`
- **THEN** the helper MUST return `{ commandRel: command }` with no `scriptRel` and MUST NOT write under `cwd`
