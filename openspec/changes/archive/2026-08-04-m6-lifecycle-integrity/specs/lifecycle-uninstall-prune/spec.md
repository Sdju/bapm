## Purpose

Defines `bapm uninstall` (remove named deps from manifest/modules/deploy/lock) and top-level `bapm prune` (remove orphan module trees absent from the resolved graph) as complementary lifecycle cleanup operations.

## ADDED Requirements

### Requirement: Uninstall removes named dependency from project
Uninstall MUST require one or more package arguments. For each named package present in the manifest and/or lock, uninstall MUST remove it from manifest dependency lists (`dependencies.apm` / `devDependencies.apm` as applicable), remove its modules tree, clean deployed harness inventory for removed deps (cursor roots when inventory exists), and rewrite the lock without that package and orphaned transitives.

#### Scenario: Uninstall direct removes manifest modules deploy and lock
- **WHEN** dep X is in the manifest, installed under modules, and has recorded deployed files, and `uninstall X` runs
- **THEN** X MUST be absent from the manifest, its modules path MUST be removed, recorded deployed files for X MUST be cleaned, and the lock MUST be rewritten without X and without orphaned transitives

#### Scenario: Uninstall unknown name fails
- **WHEN** uninstall is given a name not present in the manifest or lock
- **THEN** the exit code MUST be non-zero with a clear error

### Requirement: Uninstall supports dry-run
Uninstall MUST accept `--dry-run` and MUST NOT mutate manifest, lock, modules, or deployed files when dry-run is set.

#### Scenario: Dry-run uninstall reports only
- **WHEN** `uninstall --dry-run X` runs for an installed dep X
- **THEN** a removal plan MUST be reported and disk/manifest/lock MUST remain unchanged

### Requirement: Prune removes orphan modules not in resolved graph
Top-level `prune` MUST remove package directories under the modules directory that are absent from the resolved graph implied by the current manifest + lock transitive set. Declared/locked dependencies MUST be kept. Prune is distinct from uninstall (uninstall edits the named dep out of the manifest; prune only removes orphans).

#### Scenario: Orphan directory removed
- **WHEN** an extra directory exists under modules that is not in the resolved graph and prune runs
- **THEN** that orphan MUST be removed and declared/locked deps MUST remain

### Requirement: Prune supports dry-run
Prune MUST accept `--dry-run` and MUST report orphans without deleting them when dry-run is set.

#### Scenario: Dry-run prune reports only
- **WHEN** orphans exist and prune runs with `--dry-run`
- **THEN** orphans MUST be listed and modules trees MUST remain unchanged
