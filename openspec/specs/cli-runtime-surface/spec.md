# cli-runtime-surface Specification

## Purpose

Preserves the `bapm` CLI package public API and the existing help, version, install-stub, and unknown-command runtime behavior after the FEOD layout migration.

## Requirements

### Requirement: Public runCli export remains available
The `bapm` package MUST continue to export an async `runCli(argv: string[]) => Promise<number>` from its package root entry so programmatic callers and tests can invoke the CLI without spawning the binary.

#### Scenario: Package root re-exports runCli
- **WHEN** a consumer imports `runCli` from the package root entry (`src/index.ts` / built `dist/index`)
- **THEN** the import MUST resolve to the same CLI dispatch function used by the binary entry

### Requirement: Pack entries for index and cli remain
The package build MUST keep pack entry points for the library index and the CLI binary (currently `src/index.ts` and `src/cli.ts`, producing the configured `exports` / `bin` targets). Those files MAY become thin re-exports into `app`, but the entry paths used by `vp pack` MUST remain valid.

#### Scenario: Binary entry still boots the CLI
- **WHEN** the CLI binary entry is executed
- **THEN** it MUST invoke `runCli` with `process.argv` without the node executable and script path, and set the process exit code from the returned number

### Requirement: Version command prints name and version
Invoking `version`, `-V`, or `--version` MUST print a single line containing the product name and version (sourced from `@bapm/core`) and MUST return exit code `0`.

#### Scenario: version subcommand succeeds
- **WHEN** `runCli(["version"])` is called
- **THEN** stdout MUST include a line matching the product name followed by a version, and the return code MUST be `0`

#### Scenario: version short flag succeeds
- **WHEN** `runCli(["-V"])` is called
- **THEN** the return code MUST be `0` and stdout MUST include the product name and version

### Requirement: Help command prints usage
Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`, `init`, `pack`, `compile`, `cache`, `publish`, and `self-update` commands and MUST return exit code `0`. Help text for `install` MUST describe real install behavior (agentic dependency install), including consumption of a local pack archive path when supported, not a permanent stub disclaimer, and MUST be consistent with the install-help requirement for the supported flag subset. Help MUST mention the MCP path (install-time MCP and/or thin `mcp` command when registered). Lifecycle and producer commands MUST NOT be described as permanent stubs.

#### Scenario: help subcommand succeeds
- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`, `init`, `pack`, `compile`, `cache`, `publish`, and `self-update`, and the return code MUST be `0`

#### Scenario: default command is help
- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`

### Requirement: Install command runs core install happy path
Invoking `install` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@bapm/core` install orchestration (not a permanent not-implemented stub). On a valid project fixture happy path it MUST exit `0` with modules and lock present; when a cursor target is wired via registration and detect/force applies, deploy files under registered roots MAY/MUST appear per cursor and install-pipeline specs. The command MUST accept `--frozen` and `--no-frozen`, MUST apply CI-default frozen per the CI opt-out requirement, and MUST mirror core frozen failure/success semantics including deployed-hash re-verify when hashes exist whenever effective frozen is on. The command MUST hard-reject unknown flags and MUST reject effective frozen combined with mutation flags such as `--update` when exposed. CLI/workspace MAY depend on `bapm-target-cursor` for registration without `@bapm/core` importing that package.

#### Scenario: bapm install happy path
- **WHEN** `runCli(["install"])` is invoked in a valid project fixture with resolvable deps
- **THEN** the exit code MUST be `0`, modules and lock MUST exist, and if cursor is registered and active deploy files under registered roots MAY be present

#### Scenario: bapm install --frozen mirrors core gate
- **WHEN** `runCli(["install", "--frozen"])` is invoked
- **THEN** behavior MUST match core frozen rules (fail before mutation when lock absent or direct pin missing; no lock rewrite on success; re-verify `deployed_file_hashes` when present)

#### Scenario: install is not an unknown command
- **WHEN** `runCli(["install"])` is called
- **THEN** the CLI MUST NOT treat `install` as an unknown command

#### Scenario: frozen plus update rejected at CLI
- **WHEN** `runCli(["install", "--frozen", "--update"])` is called
- **THEN** the return code MUST be non-zero and no install mutation MUST occur

### Requirement: Install defaults to frozen under CI with explicit opt-out
The install command MUST default effective frozen mode when the `CI` environment variable is truthy per OpenAPM req-lk-018 (present and not `""`, `"0"`, or `"false"`, case-insensitive), unless the user passes an explicit non-frozen opt-out flag (`--no-frozen`). The command MUST continue to accept `--frozen` as an explicit force-on. `--frozen` and `--no-frozen` together MUST be rejected with a non-zero exit and no mutation. When effective frozen is on (explicit or CI-default), combining with `--update` MUST be rejected as today. Absent/non-truthy `CI` MUST keep today’s default non-frozen install unless `--frozen` is passed.

#### Scenario: CI=true install without flags is frozen
- **WHEN** `runCli(["install"])` runs with `CI=true` in a project without a lockfile
- **THEN** the exit code MUST be non-zero and no lockfile MUST be written (frozen fail-closed)

#### Scenario: --no-frozen under CI allows lock write
- **WHEN** `runCli(["install", "--no-frozen"])` runs with `CI=true` on a valid project fixture that needs lock write-back
- **THEN** install MUST succeed on the non-frozen path and MAY write or update the lockfile

#### Scenario: --frozen and --no-frozen conflict
- **WHEN** `runCli(["install", "--frozen", "--no-frozen"])` is called
- **THEN** the return code MUST be non-zero and no install mutation MUST occur

#### Scenario: CI-default plus --update rejected
- **WHEN** `runCli(["install", "--update"])` runs with `CI=true` and without `--no-frozen`
- **THEN** the return code MUST be non-zero and no install mutation MUST occur

### Requirement: Install unknown flags hard-error
The install command MUST reject unrecognized flags with a non-zero exit code and a clear error message naming the unknown flag. Soft-ignoring unknown flags MUST NOT occur.

#### Scenario: Unknown install flag fails
- **WHEN** `runCli(["install", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

### Requirement: Install help documents supported flag subset
Invoking install help (`bapm install --help`, `bapm help install`, or the documented equivalent) MUST describe real install behavior and MUST document the supported flag subset for this change (at least `--frozen`, `--no-frozen`, and `--target` when implemented). Help MUST note that a truthy `CI` environment variable defaults install to frozen unless `--no-frozen` is passed. Help MUST NOT describe install as a permanent stub.

#### Scenario: Install help lists frozen and is not stub
- **WHEN** install help is requested
- **THEN** stdout MUST mention install behavior and `--frozen`, MUST NOT say install is a stub, and when `--target` is supported MUST document it

#### Scenario: Install help documents --no-frozen and CI default
- **WHEN** install help is requested
- **THEN** stdout MUST mention `--no-frozen` and MUST note that truthy `CI` defaults to frozen

### Requirement: Install supports target flag with clear rejection
The install command MUST accept `--target <id>` (or an equivalent documented form). When `<id>` is `cursor` and cursor is registered, install MUST pass forced-target activation into core. When `<id>` is unknown/unregistered, install MUST fail with a clear error.

#### Scenario: Target cursor forces activation
- **WHEN** `runCli(["install", "--target", "cursor"])` runs in a valid fixture with cursor registered
- **THEN** core install MUST receive forced target `cursor` and the process MUST follow forced-target deploy rules from `install-pipeline`

#### Scenario: Unknown target id rejected
- **WHEN** `runCli(["install", "--target", "not-a-host"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST clearly reject the unknown target

### Requirement: Unknown command fails with help
Invoking an unrecognized command MUST print an error naming that command, MUST print help usage, and MUST return exit code `1`.

#### Scenario: unknown command reports error
- **WHEN** `runCli(["not-a-real-command"])` is called
- **THEN** stderr MUST mention the unknown command, help usage MUST be shown, and the return code MUST be `1`

### Requirement: Lock command is registered and runnable
Invoking `lock` MUST be recognized by CLI dispatch and MUST invoke the lock command handler (thin FEOD command → module → `@bapm/core` `resolveAndLock`). Success and failure exit codes MUST follow the `lock-command` capability.

#### Scenario: lock subcommand is not unknown
- **WHEN** `runCli(["lock"])` is called
- **THEN** the CLI MUST NOT treat `lock` as an unknown command

### Requirement: Lifecycle integrity commands are registered
Invoking `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, and `doctor` MUST be recognized by CLI dispatch (not treated as unknown commands). Each MUST invoke a thin FEOD command → module path that calls the corresponding `@bapm/core` lifecycle/integrity API. Unknown flags on these commands MUST hard-error with non-zero exit.

#### Scenario: Update is not unknown
- **WHEN** `runCli(["update", "--help"])` or `runCli(["update", "--dry-run"])` is called in a valid project context
- **THEN** the CLI MUST NOT treat `update` as an unknown command

#### Scenario: Unknown flag on lifecycle command fails
- **WHEN** `runCli(["outdated", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

### Requirement: deps subcommands list and tree are runnable
Invoking `deps list` and `deps tree` MUST be recognized and MUST exit according to the `deps-inspect` capability. `deps why` MAY be registered when implemented.

#### Scenario: deps list is not unknown
- **WHEN** `runCli(["deps", "list"])` is called against a project with a lock
- **THEN** the CLI MUST NOT treat `deps` or `list` as an unknown command path

### Requirement: audit --ci is the CI integrity gate surface
Invoking `audit --ci` MUST run the core audit CI gate and MUST map exit codes 0/1 per `audit-integrity`.

#### Scenario: audit --ci is not unknown
- **WHEN** `runCli(["audit", "--ci"])` is called
- **THEN** the CLI MUST NOT treat `audit` as an unknown command and MUST apply CI gate semantics

### Requirement: Producer commands init and pack are registered
Invoking `init` and `pack` MUST be recognized by CLI dispatch (not treated as unknown commands). Each MUST invoke a thin FEOD command → module path that calls the corresponding `@bapm/core` producer API. Unknown flags on these commands MUST hard-error with non-zero exit. Help text for install MUST mention that a local pack archive path is an accepted install source when that path is implemented.

#### Scenario: init and pack are not unknown
- **WHEN** `runCli(["init", "-y", "demo"])` or `runCli(["pack", "--archive"])` is called in an appropriate fixture context
- **THEN** the CLI MUST NOT treat `init` or `pack` as an unknown command

#### Scenario: Unknown flag on pack fails
- **WHEN** `runCli(["pack", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

#### Scenario: Install accepts archive path argument
- **WHEN** `runCli(["install", "/path/to/pack.zip"])` is invoked with a pack-produced archive
- **THEN** the CLI MUST NOT treat the archive path as an unknown command and MUST apply install-from-archive semantics from `install-pipeline` / `producer-pack-archive`

### Requirement: Install accepts policy and no-policy flags
The install command MUST accept `--policy <path>` and `--no-policy`. Explicit `--policy` MUST be passed to core discovery. `--no-policy` MUST skip the policy gate. Environment `BAPM_POLICY_DISABLE=1` (and optionally `APM_POLICY_DISABLE=1`) MUST also skip the gate when set. Dual-conflict of local policy files MUST yield non-zero exit before durable install writes.

#### Scenario: Install --policy uses explicit file
- **WHEN** `runCli(["install", "--policy", "<path-to-bapm-policy.yml>"])` runs against a fixture where that policy denies a dep with block
- **THEN** install MUST use that policy and MUST fail closed without modules/deploy writes for the proposed install

#### Scenario: Install --no-policy escapes deny
- **WHEN** a blocking deny policy is at project root and `runCli(["install", "--no-policy"])` is invoked
- **THEN** install MUST skip the gate and MAY succeed

### Requirement: Install help documents policy flags
Install help MUST document `--policy` and `--no-policy` (and MAY mention env disable).

#### Scenario: Install help lists policy flags
- **WHEN** install help is requested
- **THEN** stdout MUST mention `--policy` and `--no-policy`

### Requirement: Optional thin policy status command
The CLI MAY register a thin `policy` / `policy status` command that reports whether a policy was discovered, its path/filename, and enforcement mode. If registered, unknown flags MUST hard-error and help MUST list it. If not registered in M8, conformance MUST document diagnostics-via-install only.

#### Scenario: Policy status not unknown when registered
- **WHEN** `policy status` is implemented and `runCli(["policy", "status"])` is invoked in a project with a local policy
- **THEN** the CLI MUST NOT treat `policy` as an unknown command and MUST report discovery outcome

### Requirement: Compile command emits AGENTS.md
Invoking `compile` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@bapm/core` compile orchestration (not a permanent stub). On a valid cursor-oriented fixture it MUST write `AGENTS.md` (unless `--validate`) and exit `0`. Unknown flags MUST be hard-rejected.

#### Scenario: bapm compile happy path
- **WHEN** `runCli(["compile"])` is invoked in a valid project fixture with discoverable primitives
- **THEN** the exit code MUST be `0` and `AGENTS.md` MUST exist unless `--validate` was passed

#### Scenario: compile unknown flag rejected
- **WHEN** `runCli(["compile", "--not-a-real-flag"])` is called
- **THEN** the CLI MUST hard-reject with non-zero exit

### Requirement: Cache info and clean commands
Invoking `cache info` and `cache clean` MUST be recognized and MUST delegate to thin FEOD modules over core cache helpers. `cache info` MUST exit `0` with root/stats output. `cache clean` MUST honor `-y` / confirmation semantics from the cache-cli-ux spec. Unknown flags MUST be hard-rejected.

#### Scenario: bapm cache info
- **WHEN** `runCli(["cache", "info"])` is invoked
- **THEN** exit code MUST be `0` and stdout MUST mention the cache root or stats

#### Scenario: bapm cache clean -y
- **WHEN** `runCli(["cache", "clean", "-y"])` is invoked against a writable cache root
- **THEN** cache content under that root MUST be removed per cache-cli-ux rules

### Requirement: Install documents MCP and trust-transitive flag
Install help/flag surface MUST document MCP deploy behavior for cursor and MUST expose the trust-transitive-MCP flag when implemented. Unknown flags remain hard errors.

#### Scenario: Install help mentions MCP path
- **WHEN** install help is shown
- **THEN** text MUST mention MCP / `.cursor/mcp.json` or equivalent install-time MCP behavior for cursor

### Requirement: Publish command is registered
Invoking `publish` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@bapm/core` publish APIs (subject to experimental gate). Unknown flags MUST hard-error with non-zero exit.

#### Scenario: publish is not unknown
- **WHEN** `runCli(["publish", "--help"])` or gated publish dry-run is invoked
- **THEN** the CLI MUST NOT treat `publish` as an unknown command

#### Scenario: Unknown publish flag fails
- **WHEN** `runCli(["publish", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

### Requirement: Self-update command is registered
Invoking `self-update` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path. `--check` MUST be supported. Unknown flags MUST hard-error with non-zero exit.

#### Scenario: self-update is not unknown
- **WHEN** `runCli(["self-update", "--check"])` is called (with stubbed metadata as needed)
- **THEN** the CLI MUST NOT treat `self-update` as an unknown command

#### Scenario: Unknown self-update flag fails
- **WHEN** `runCli(["self-update", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag
