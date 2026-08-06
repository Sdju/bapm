## ADDED Requirements

### Requirement: Positional marketplace refs pre-resolve
Install MUST recognize positional arguments matching marketplace refs `NAME@MARKETPLACE[#ref]` (same parser as marketplace-plugin-resolve). For each such positional, when not dry-run and not frozen, install MUST pre-resolve via marketplace plugin resolve before treating the argument as a generic package-ref, add an appropriate dependency declaration (marketplace string or equivalent object form) to the manifest brand path used by positional add, and continue normal install orchestration so the package is materialized under the modules directory like other installs. Invalid marketplace refs, missing marketplaces/plugins, fetch failures, and unsupported plugin sources MUST fail closed with clear errors before claiming success. Non-marketplace positionals MUST keep existing package-ref / zip behavior.

#### Scenario: Positional NAME@MARKETPLACE installs
- **WHEN** non-frozen install is invoked with positional `demo@local-mp` against a registered local marketplace containing `demo`
- **THEN** install MUST succeed (exit 0), modules MUST contain the installed package, and the lock MUST include marketplace provenance for that entry

#### Scenario: Positional marketplace miss fails
- **WHEN** install is invoked with positional `missing@no-such-market`
- **THEN** install MUST fail non-zero with a clear marketplace/plugin error and MUST NOT mutate as a successful bare-git add of that token

## MODIFIED Requirements

### Requirement: Positional non-zip package refs add then install
Install MUST accept one or more positional package references that are not pack `.zip` archives. For each such ref, when not dry-run and not frozen, install MUST validate the ref, add it to `dependencies.apm` by default (dual-read brand), or to `devDependencies.apm` when the dev flag is set, and continue with normal install orchestration. A positional argument that matches a marketplace ref `NAME@MARKETPLACE[#ref]` MUST be handled per the positional marketplace pre-resolve requirement (not as a bare git/path package-ref). A positional argument whose path ends with `.zip` (or is otherwise classified as a pack archive) MUST keep existing archive-extract semantics and MUST NOT be treated as a package-ref add. Ambiguous or invalid refs MUST fail closed with a clear error before claiming success.

#### Scenario: Package ref adds to dependencies.apm
- **WHEN** non-frozen install is invoked with a valid positional package ref, no `.zip` archive classification, not a marketplace ref, and without the dev flag
- **THEN** the project manifest MUST gain that ref under `dependencies.apm` and install MUST proceed for the updated manifest

#### Scenario: Zip path stays archive install
- **WHEN** install is invoked with a positional path to a pack-produced `.zip`
- **THEN** install MUST apply archive-consume semantics and MUST NOT treat the path as a dependencies.apm package-ref add

#### Scenario: Package ref with --dev adds to devDependencies.apm
- **WHEN** non-frozen install is invoked with `--dev` and a valid positional package ref
- **THEN** the project manifest MUST gain that ref under `devDependencies.apm`

### Requirement: Lock write includes marketplace provenance
When a resolved dependency originated from marketplace resolve, non-frozen lock write-back MUST set on that dependency entry at least `discovered_via` (marketplace alias) and `marketplace_plugin_name`. When the marketplace/plugin metadata provides them, the entry MUST also set `source_url` and/or `source_digest`. The lock entry MUST retain concrete resolved coordinates (git/local/registry fields as applicable) while attaching these provenance keys — matching APM intent. Provenance fields MUST round-trip through lockfile load/serialize.

#### Scenario: Install lock records discovered_via and plugin name
- **WHEN** a successful non-frozen install materializes a marketplace-origin dependency
- **THEN** the written lock dependency MUST include `discovered_via` equal to the marketplace alias and `marketplace_plugin_name` equal to the plugin name

#### Scenario: Optional source_url and source_digest when present
- **WHEN** the fetched marketplace metadata includes source URL and/or digest fields for that resolution
- **THEN** the lock entry MUST also include `source_url` and/or `source_digest` accordingly
