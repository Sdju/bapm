## ADDED Requirements

### Requirement: Dual-consent gate for direct HTTP dependencies

Install MUST treat a direct APM dependency whose resolved fetch URL uses the `http://` scheme as insecure. Such a dependency MUST be allowed only when **both** (a) the manifest object entry for that dependency sets `allow_insecure: true` and (b) the install invocation sets the allow-insecure flag (`--allow-insecure` / core equivalent). If either consent is missing, install MUST fail closed before download/materialize with an error that names the URL and the missing step(s) (manifest `allow_insecure` and/or CLI flag), APM-shaped. HTTPS and non-HTTP transports MUST NOT require this gate solely due to scheme.

#### Scenario: HTTP direct blocked without CLI flag

- **WHEN** install resolves a direct `http://` dependency with `allow_insecure: true` in the manifest but without the allow-insecure invocation flag
- **THEN** install MUST fail closed with remediation that asks to pass `--allow-insecure` and MUST NOT download that dep

#### Scenario: HTTP direct blocked without manifest allow

- **WHEN** install resolves a direct `http://` dependency without `allow_insecure: true` on the entry, with or without the CLI flag
- **THEN** install MUST fail closed citing the missing manifest `allow_insecure: true` step (and the CLI flag only when it is also missing)

#### Scenario: Dual consent allows HTTP direct

- **WHEN** a direct `http://` dependency has `allow_insecure: true` and install runs with `--allow-insecure`
- **THEN** the dual-consent gate MUST NOT block that dependency solely for being HTTP

### Requirement: Transitive HTTP host allowlist

Install MUST block transitive `http://` dependencies whose hostname is not on an allowlist built from repeatable `--allow-insecure-host` values plus, when `--allow-insecure` is set, hostnames of approved **direct** insecure dependencies. Blocked hosts MUST produce a fail-closed error that suggests `--allow-insecure-host <hostname>` for each blocked host. Invalid hostname tokens passed to `--allow-insecure-host` MUST fail closed at parse/validation (bare FQDN expected).

#### Scenario: Transitive HTTP without host allow fails

- **WHEN** install would fetch a transitive `http://` dependency whose host is not allowlisted
- **THEN** install MUST fail closed naming the unapproved host(s) and MUST NOT complete that fetch path

#### Scenario: Allow-insecure-host permits transitive HTTP

- **WHEN** install runs with `--allow-insecure-host` covering the transitive HTTP hostname (or the host is contributed by an approved direct under `--allow-insecure`)
- **THEN** the transitive host gate MUST NOT block solely for that host

### Requirement: Install only-mode skips APM or MCP sides

Install public options MUST accept an only-mode of `apm` or `mcp` (CLI `--only`). When `apm`, install MUST run the APM package resolve/download/materialize path and MUST skip MCP configure / `.cursor/mcp.json` writes for that invocation. When `mcp`, install MUST run the MCP configure path (subject to existing trust/exclude/detect rules) and MUST skip APM package download/materialize into the project modules tree for that invocation; lock MCP restoration semantics already present MUST be preserved where applicable. Values other than `apm` or `mcp` MUST be rejected fail-closed. Only-mode MUST NOT weaken frozen or policy gates on the work that still runs.

#### Scenario: only apm skips MCP configure

- **WHEN** install would otherwise configure Cursor MCP and is invoked with only-mode `apm`
- **THEN** `.cursor/mcp.json` MUST remain unchanged by configureMcp on that run and APM package work MAY still proceed

#### Scenario: only mcp skips APM materialize

- **WHEN** install is invoked with only-mode `mcp` on a project that would otherwise download/materialize APM packages
- **THEN** install MUST NOT materialize APM package trees into the project modules directory for that invocation and MAY still configure MCP

### Requirement: Force flag does not bypass frozen or policy

Install public options MUST accept a force flag (`--force`). Force MUST NOT re-resolve/refresh mutable refs by itself, MUST NOT bypass effective frozen gates, and MUST NOT disable policy discovery/evaluation. Cursor project materialize MAY continue to overwrite destination files when content differs (collision protective-skip is out of this change); force remains accepted for CLI parity and any future thin security-gate bypass without inventing a full scanner in this slice. Force MUST remain distinct from forced-target activation (`--target` / `forcedTarget`).

#### Scenario: Force accepted without weakening frozen

- **WHEN** effective frozen install is invoked with `--force` and a pin or hash integrity failure would occur
- **THEN** install MUST still fail closed identically to frozen without force

#### Scenario: Force does not disable policy

- **WHEN** install runs with `--force` against a blocking deny policy and without `--no-policy`
- **THEN** the policy gate MUST still fail closed before durable installs writes that policy would block

### Requirement: Dev positional adds to devDependencies

When positional package-ref add runs with the dev flag (`--dev`), install MUST write validated refs under `devDependencies.apm` (creating the `devDependencies` / `apm` block if needed), not under `dependencies.apm`. Without positional package refs, `--dev` MUST NOT invent durable side effects (no-op or warn only). Dry-run + `--dev` + positional MUST preview would-add under `devDependencies.apm` without write. Frozen×positional reject rules MUST still apply.

#### Scenario: Positional with --dev writes devDependencies.apm

- **WHEN** non-frozen install is invoked with `--dev` and a valid positional package ref
- **THEN** the manifest MUST gain that ref under `devDependencies.apm` and MUST NOT place it under `dependencies.apm` solely due to that add

#### Scenario: --dev without positional is non-mutating

- **WHEN** install is invoked with `--dev` and no positional package refs
- **THEN** install MUST NOT mutate the manifest solely because `--dev` was set

## MODIFIED Requirements

### Requirement: Positional non-zip package refs add then install

Install MUST accept one or more positional package references that are not pack `.zip` archives. For each such ref, when not dry-run and not frozen, install MUST validate the ref, add it to `dependencies.apm` by default (dual-read brand), or to `devDependencies.apm` when the dev flag is set, and continue with normal install orchestration. A positional argument whose path ends with `.zip` (or is otherwise classified as a pack archive) MUST keep existing archive-extract semantics and MUST NOT be treated as a package-ref add. Ambiguous or invalid refs MUST fail closed with a clear error before claiming success.

#### Scenario: Package ref adds to dependencies.apm

- **WHEN** non-frozen install is invoked with a valid positional package ref, no `.zip` archive classification, and without the dev flag
- **THEN** the project manifest MUST gain that ref under `dependencies.apm` and install MUST proceed for the updated manifest

#### Scenario: Zip path stays archive install

- **WHEN** install is invoked with a positional path to a pack-produced `.zip`
- **THEN** install MUST apply archive-consume semantics and MUST NOT treat the path as a dependencies.apm package-ref add

#### Scenario: Package ref with --dev adds to devDependencies.apm

- **WHEN** non-frozen install is invoked with `--dev` and a valid positional package ref
- **THEN** the project manifest MUST gain that ref under `devDependencies.apm`
