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

### Requirement: Lock unknown flags hard-error
The `lock` command MUST reject unrecognized flags on the bare resolve+write path with a non-zero exit code and a clear error message naming the unknown flag. Soft-ignoring unknown flags MUST NOT occur. Behavior details and known allowlist follow the `lock-command` capability.

#### Scenario: Unknown lock flag rejected at CLI
- **WHEN** `runCli(["lock", "--not-a-real-flag"])` is invoked
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

### Requirement: Lifecycle integrity commands are registered
Invoking `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, and `doctor` MUST be recognized by CLI dispatch (not treated as unknown commands). Each MUST invoke a thin FEOD command → module path that calls the corresponding `@bapm/core` lifecycle/integrity API. Unknown flags on these commands MUST hard-error with non-zero exit.

#### Scenario: Update is not unknown
- **WHEN** `runCli(["update", "--help"])` or `runCli(["update", "--dry-run"])` is called in a valid project context
- **THEN** the CLI MUST NOT treat `update` as an unknown command

#### Scenario: Unknown flag on lifecycle command fails
- **WHEN** `runCli(["outdated", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

### Requirement: deps subcommands list and tree are runnable
Invoking `deps list` and `deps tree` MUST be recognized and MUST exit according to the `deps-inspect` capability. `deps why` MUST be registered. `deps clean` MUST be registered per the added clean requirement. Unknown deps subcommands and unknown flags MUST hard-error with non-zero exit.

#### Scenario: deps list is not unknown
- **WHEN** `runCli(["deps", "list"])` is called against a project with a lock
- **THEN** the CLI MUST NOT treat `deps` or `list` as an unknown command path

#### Scenario: deps why is not unknown
- **WHEN** `runCli(["deps", "why", "pkg"])` is called against a project with a lock
- **THEN** the CLI MUST NOT treat `why` as an unknown deps subcommand

### Requirement: deps why accepts --json
The `deps` command MUST accept `--json` on the `why` subcommand. When set, CLI MUST request machine-readable why output from core and MUST write success JSON to stdout and error JSON to stderr per `deps-inspect`. Unknown flags on `deps` (including `--json` on subcommands that do not support it) MUST hard-error with non-zero exit. Help for `deps` MUST document `why --json`.

#### Scenario: why --json is recognized
- **WHEN** `runCli(["deps", "why", "pkg", "--json"])` is invoked against a fixture where why can succeed or fail per deps-inspect
- **THEN** the CLI MUST NOT treat `--json` as an unknown flag and MUST apply deps-inspect JSON stream/exit rules

#### Scenario: --json on list fails closed
- **WHEN** `runCli(["deps", "list", "--json"])` is invoked
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown or unsupported flag

### Requirement: deps clean subcommand is registered
Invoking `deps clean` MUST be recognized (not an unknown subcommand). It MUST accept `-y` / `--yes` and MUST accept `--dry-run` for a non-deleting modules-wipe preview. It MUST delegate to the same modules-cache clean path as `cache clean` (core `cacheClean` / equivalent). Help MUST document `deps clean`, `--dry-run`, and MUST state equivalence to modules wipe / `cache clean` (not APM shared git/http cache). Unknown flags MUST hard-error.

#### Scenario: deps clean is not unknown
- **WHEN** `runCli(["deps", "clean", "-y"])` is called
- **THEN** the CLI MUST NOT treat `clean` as an unknown deps subcommand

#### Scenario: deps help mentions json and clean
- **WHEN** deps help is printed (`deps --help` or equivalent)
- **THEN** stdout MUST mention `--json` (for why) and MUST mention `clean` with modules-wipe / `cache clean` equivalence

#### Scenario: deps help mentions dry-run
- **WHEN** deps help is printed
- **THEN** stdout MUST mention `--dry-run` for clean

### Requirement: deps help documents short-form why queries
Deps help MUST document that `deps why` accepts short-form queries: unique basename and unique `owner/repo` derived from lock `repo_url`, in addition to exact `name` / `repo_url`. Examples such as `deps why shared-utils` and `deps why acme-org/shared-utils` MUST appear (or equivalent). Unknown flags MUST remain fail-closed.

#### Scenario: Help mentions basename and owner/repo
- **WHEN** deps help is printed (`deps --help` or equivalent)
- **THEN** stdout MUST mention basename and/or `owner/repo` short-form why usage (examples acceptable)

### Requirement: deps clean accepts --dry-run
The `deps` command MUST accept `--dry-run` on the `clean` subcommand. When set, CLI MUST request a modules-wipe preview from the same core clean path used by `cache clean` / `deps clean` and MUST apply deps-inspect dry-run semantics (no delete; no `-y` required). `--dry-run` on other deps subcommands MUST fail closed. Help MUST document `--dry-run` for clean.

#### Scenario: clean --dry-run is recognized
- **WHEN** `runCli(["deps", "clean", "--dry-run"])` is invoked against a project with or without `apm_modules`
- **THEN** the CLI MUST NOT treat `--dry-run` as an unknown flag and MUST NOT delete modules content

#### Scenario: --dry-run on why fails closed
- **WHEN** `runCli(["deps", "why", "pkg", "--dry-run"])` is invoked
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown or unsupported flag

### Requirement: audit --ci is the CI integrity gate surface
Invoking `audit --ci` MUST run the core audit CI gate and MUST map exit codes 0/1 per `audit-integrity`. Structured formats (`json` / `sarif`) MUST use the same gate outcome as `text` for the same project tree.

#### Scenario: audit --ci is not unknown
- **WHEN** `runCli(["audit", "--ci"])` is called
- **THEN** the CLI MUST NOT treat `audit` as an unknown command and MUST apply CI gate semantics

#### Scenario: format does not flip exit vs text
- **WHEN** the same failing fixture is audited with `-f text` and with `-f json`
- **THEN** both runs MUST exit `1`

### Requirement: audit supports --format and --output
The `audit` command MUST accept `--format` / `-f` with values `text`, `json`, or `sarif` (default `text` when neither `-f` nor extension auto-detect applies) and `--output` / `-o <path>` to write the report body to a file. Unknown `--format` values MUST hard-error with non-zero exit and MUST NOT write a report file. Help for `audit` MUST document `bapm audit --ci` with optional `-f text|json|sarif` and `-o path`. Exit codes MUST remain `0` clean / `1` fail per `audit-integrity` regardless of format. When `-o` is provided and `-f` is omitted, the CLI SHOULD auto-detect format from the path: `.sarif` or `.sarif.json` → `sarif`, `.json` → `json`; other extensions keep `text`. Explicit `-f` MUST win over extension detection. Markdown format MUST NOT be accepted for audit CI in this change (unknown / unsupported → fail-closed).

#### Scenario: -f json is recognized
- **WHEN** `runCli(["audit", "--ci", "-f", "json"])` runs on a clean fixture
- **THEN** the exit code MUST be `0` and stdout MUST be JSON with `passed: true`

#### Scenario: unknown -f fails closed
- **WHEN** `runCli(["audit", "--ci", "-f", "xml"])` is called
- **THEN** the return code MUST be non-zero and no report file MUST be written

#### Scenario: -o with .sarif extension auto-detects when -f omitted
- **WHEN** `runCli(["audit", "--ci", "-o", "out.sarif"])` runs without `-f` on a clean fixture
- **THEN** the file `out.sarif` MUST contain SARIF 2.1 with driver name `bapm-audit` and exit code MUST be `0`

#### Scenario: explicit -f wins over extension
- **WHEN** `runCli(["audit", "--ci", "-f", "json", "-o", "out.sarif"])` runs on a clean fixture
- **THEN** `out.sarif` MUST contain JSON (not SARIF) matching the CIAuditResult shape

#### Scenario: audit help mentions formats
- **WHEN** `runCli(["audit", "--help"])` is called
- **THEN** stdout MUST mention `--ci`, `-f` / `--format` with `text|json|sarif`, and `-o` / `--output`

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
Invoking `compile` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@bapm/core` compile orchestration (not a permanent stub). On a valid cursor-oriented fixture it MUST write the configured output file (default `AGENTS.md`) unless `--validate` or `--dry-run` applies, and exit `0` on success. The CLI MUST accept `-o` / `--output`, `--dry-run`, `-v` / `--verbose`, and `--validate` per compile-agents-md. Unknown flags MUST be hard-rejected.

#### Scenario: bapm compile happy path
- **WHEN** `runCli(["compile"])` is invoked in a valid project fixture with discoverable primitives
- **THEN** the exit code MUST be `0` and `AGENTS.md` MUST exist unless `--validate` or `--dry-run` was passed

#### Scenario: compile unknown flag rejected
- **WHEN** `runCli(["compile", "--not-a-real-flag"])` is called
- **THEN** the CLI MUST hard-reject with non-zero exit

#### Scenario: compile dry-run happy path no write
- **WHEN** `runCli(["compile", "--dry-run"])` is invoked in a valid project fixture and `AGENTS.md` is absent
- **THEN** the exit code MUST be `0` and `AGENTS.md` MUST remain absent

### Requirement: Compile help documents polish flags
`bapm compile --help` / `-h` MUST document `-o` / `--output`, `--dry-run`, `-v` / `--verbose`, and `--validate`. Help MUST NOT list `--no-links`, `--target`, `--all`, `-g` / `--global`, `--watch`, `--root`, `--clean`, or `--single-agents` as supported flags in this change. Help MUST NOT claim multi-host optimizer or distributed placement behavior.

#### Scenario: Compile help lists polish flags
- **WHEN** `bapm compile --help` (or `-h`) runs
- **THEN** exit code MUST be `0` and help text MUST mention `-o` or `--output`, `--dry-run`, `-v` or `--verbose`, and `--validate`

#### Scenario: Compile help omits deferred and multi-host flags
- **WHEN** `bapm compile --help` runs
- **THEN** help text MUST NOT advertise `--no-links`, `--target`, `--all`, `--global`, `--watch`, `--root`, `--clean`, or `--single-agents` as available options

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

### Requirement: Install command supports dry-run flag
The install command MUST accept `--dry-run`. When set, CLI MUST pass dry-run into `@bapm/core` install and MUST exit `0` on a successful preview path with messaging that no durable project changes were made (or equivalent). Project durable paths MUST remain unchanged per install-pipeline dry-run rules. Help MUST document `--dry-run`.

#### Scenario: bapm install --dry-run previews without writes
- **WHEN** `runCli(["install", "--dry-run"])` runs in a valid project fixture
- **THEN** the exit code MUST be `0`, stdout/stderr MUST indicate a dry-run/preview, and manifest/lock/modules/harness MUST be unchanged

### Requirement: Install accepts positional package refs and zip disambiguation
The install command MUST accept positional non-flag arguments as either a pack `.zip` archive path (existing behavior) or one or more package references to add. Classification MUST prefer archive semantics for `.zip` paths. Multiple package refs MAY be accepted; combining archive zip with package-ref add in one invocation MUST fail closed or follow a documented single-mode rule (prefer fail closed). Help MUST document package-ref add vs archive zip.

#### Scenario: Positional package ref via CLI
- **WHEN** `runCli(["install", "owner/repo"])` (or an equivalent valid package ref) runs non-frozen without dry-run
- **THEN** the CLI MUST NOT treat the argument as an unknown flag and MUST apply package-ref add + install semantics from install-pipeline

#### Scenario: Positional zip still archive
- **WHEN** `runCli(["install", "/path/to/pack.zip"])` is invoked with a pack-produced archive
- **THEN** archive install semantics MUST apply as today

### Requirement: Install rejects frozen with positional package add
When effective frozen is on, `runCli` install with positional package-ref add (non-dry-run) MUST exit non-zero without mutation. Dry-run with positional MUST preview without write.

#### Scenario: Frozen positional rejected at CLI
- **WHEN** `runCli(["install", "--frozen", "owner/repo"])` is called without `--dry-run`
- **THEN** the return code MUST be non-zero and the manifest MUST remain unchanged

#### Scenario: Dry-run positional at CLI
- **WHEN** `runCli(["install", "--dry-run", "owner/repo"])` is called
- **THEN** the return code MUST be `0` (or documented preview success) and the manifest MUST remain unchanged

### Requirement: Install exposes parallel-downloads verbose and exclude
The install command MUST accept `--parallel-downloads <int>` (default 4; `0` = serial), `-v` / `--verbose`, and `--exclude <id>`. Values MUST be forwarded to core. Unknown flags remain hard errors. `--exclude cursor` MUST skip Cursor MCP configure per install-pipeline / cursor-mcp-deploy. Help MUST document these flags and clarify that `--exclude` filters MCP/runtime configure (not “skip install”).

#### Scenario: parallel-downloads flag accepted on install
- **WHEN** `runCli(["install", "--parallel-downloads", "2"])` is invoked on a valid project
- **THEN** the CLI MUST NOT reject the flag as unknown and MUST pass concurrency `2` into core

#### Scenario: verbose short flag accepted
- **WHEN** `runCli(["install", "-v"])` is invoked on a valid project context
- **THEN** the CLI MUST NOT reject `-v` as unknown

#### Scenario: exclude cursor accepted
- **WHEN** `runCli(["install", "--exclude", "cursor", "--target", "cursor"])` runs with eligible MCP
- **THEN** `.cursor/mcp.json` MUST NOT be written/updated for that run while the command MAY still succeed for packages

#### Scenario: Install help lists new UX flags
- **WHEN** install help is requested
- **THEN** stdout MUST mention `--dry-run`, `--parallel-downloads`, `-v`/`--verbose`, and `--exclude`

### Requirement: CLI policy status subcommand
The CLI MUST expose `bapm policy status` as a registered command path under group `policy` with **only** the `status` subcommand in this change (`explain` / approve-deny MUST NOT be added). Top-level help MUST mention `policy`. Status MUST accept `--json`, `--policy <path>`, `--no-policy`, and `--check`. Status MUST NOT expose `--no-cache` unless bapm discovery gains a truthful cache switch (omit rather than invent). Unknown flags MUST fail closed with non-zero exit for parse errors.

#### Scenario: Help lists policy
- **WHEN** top-level help is printed
- **THEN** it MUST mention the `policy` command

#### Scenario: Status help
- **WHEN** `bapm policy status --help` runs
- **THEN** it MUST document `--json`, `--policy`, `--no-policy`, and `--check`

#### Scenario: Unknown flag rejected
- **WHEN** `bapm policy status` is invoked with an unknown flag
- **THEN** the process MUST exit non-zero with an error naming the flag

### Requirement: Status exit contract
Default `bapm policy status` (human or `--json`) MUST exit `0` for found, absent, disabled, dual-conflict diagnostics, and soft discovery/fetch/schema failures. With `--check`, exit MUST be non-zero when no usable policy is available (absent/disabled/unusable/error), and `0` when a usable policy is found.

#### Scenario: Default exit zero when absent
- **WHEN** status runs without `--check` and no policy is found
- **THEN** exit code MUST be `0`

#### Scenario: Default exit zero on soft failure
- **WHEN** status runs without `--check` and discovery/load yields dual-conflict or fetch/schema failure
- **THEN** exit code MUST be `0` and output MUST still report the diagnostic outcome

#### Scenario: Check mode fails when absent
- **WHEN** status runs with `--check` and no usable policy is found
- **THEN** exit code MUST be non-zero

#### Scenario: Explicit policy path
- **WHEN** status runs with `--policy <path>` pointing at a valid policy file
- **THEN** the report MUST use that source and default exit MUST be `0`

#### Scenario: Escape via flag or env
- **WHEN** status runs with `--no-policy` or with `BAPM_POLICY_DISABLE=1` / `APM_POLICY_DISABLE=1`
- **THEN** the report MUST show disabled/escaped posture and default exit MUST be `0` (non-zero only with `--check`)

### Requirement: outdated accepts verbose flag
The `outdated` command MUST accept `-v` and `--verbose` as equivalent flags enabling richer detail in the report. Help for `outdated` MUST document `-v` / `--verbose` and MUST state that outdated is report-only while `update` remains the mutating refresh command. Unknown flags on `outdated` MUST continue to hard-error with non-zero exit. Exit policy from `lifecycle-outdated` MUST remain unchanged (outdated rows → exit `0`; missing lock → non-zero).

#### Scenario: -v is recognized
- **WHEN** `runCli(["outdated", "-v"])` or `runCli(["outdated", "--verbose"])` runs against a project with a lock
- **THEN** the CLI MUST NOT treat the flag as unknown and MUST exit according to lifecycle-outdated rules

#### Scenario: Unknown outdated flag still fails
- **WHEN** `runCli(["outdated", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

#### Scenario: Help mentions verbose and report-only
- **WHEN** outdated help is requested (`outdated --help` / `-h` or equivalent)
- **THEN** help text MUST mention `-v` / `--verbose` and MUST indicate that outdated does not modify the lock (update does)

### Requirement: outdated accepts parallel-checks and json flags
The `outdated` command MUST accept `-j <n>` and `--parallel-checks <n>` (and `=<n>` forms consistent with other parallel CLI flags) as equivalent ways to set remote-check concurrency. When the flag is omitted, CLI MUST apply default **4**. Value **`0` MUST mean serial**. Invalid or missing numeric values MUST fail with non-zero exit and a clear error. Parsed concurrency MUST be forwarded to `@bapm/core` outdated. The command MUST also accept `--json` (long form only): when set, success MUST write stable JSON of existing outdated rows to stdout and MUST NOT print the human table/text; errors MUST go to stderr (same posture as `deps why --json` / `policy status --json`). Combining `--json` with `-j` / `-v` MUST be allowed; JSON wins over human text. **`-j` MUST NOT enable JSON** (APM binds `-j` to parallel-checks only). Help MUST document `-j` / `--parallel-checks` (default 4 / `0` serial) and `--json` as bapm machine output of real rows — MUST NOT claim APM has `outdated --json`. Unknown flags MUST remain fail-closed. Exit policy from `lifecycle-outdated` MUST remain unchanged. JSON MUST use only fields already computed on rows (`name`, `status`, `current`, `latest`, optional `repo_url` / `tip_ref` / `detail`); inventing APM-only keys such as marketplace/registry `source` is FORBIDDEN.

#### Scenario: -j and --parallel-checks are recognized
- **WHEN** `runCli(["outdated", "-j", "2"])` or `runCli(["outdated", "--parallel-checks", "8"])` (or `=n` equivalent) runs against a project with a lock
- **THEN** the CLI MUST NOT treat the flag as unknown and MUST exit according to lifecycle-outdated rules

#### Scenario: Default parallel-checks is four when omitted
- **WHEN** `runCli(["outdated"])` runs without `-j` / `--parallel-checks`
- **THEN** core MUST receive concurrency default **4** (equivalent to APM Click default)

#### Scenario: parallel-checks zero accepted as serial
- **WHEN** `runCli(["outdated", "-j", "0"])` or `--parallel-checks 0` is invoked against a project with a lock
- **THEN** the CLI MUST NOT treat `0` as invalid and MUST forward serial semantics to core

#### Scenario: Invalid parallel-checks fails closed
- **WHEN** `runCli(["outdated", "--parallel-checks", "nope"])` or `-j` without a numeric value is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the invalid or missing value

#### Scenario: --json emits row JSON without human table
- **WHEN** `runCli(["outdated", "--json"])` succeeds against a project with a lock
- **THEN** stdout MUST be parseable JSON whose dependency rows use core OutdatedRow keys (`name`, `status`, and present optional fields), MUST NOT invent APM-only `source` labels, and MUST NOT also print the human summary table

#### Scenario: -j does not mean json
- **WHEN** `runCli(["outdated", "-j", "4"])` runs without `--json`
- **THEN** output MUST remain human text (not JSON-only) and concurrency MUST still apply

#### Scenario: Help mentions parallel-checks and json
- **WHEN** outdated help is requested (`outdated --help` / `-h` or equivalent)
- **THEN** help text MUST mention `-j` / `--parallel-checks` (including default 4 and `0` = serial) and `--json`, and MUST still indicate report-only vs `update`

### Requirement: Update exposes verbose and parallel-downloads flags
The `update` command MUST accept `-v` / `--verbose` and `--parallel-downloads <n>` (and `--parallel-downloads=<n>`). Verbose MUST enable keep-row plan printing per `lifecycle-update`. `--parallel-downloads` MUST parse a non-negative integer (`0` = serial); when omitted, CLI/core MUST apply default **4**. Invalid or missing values for `--parallel-downloads` MUST fail with non-zero exit and a clear error. Values MUST be forwarded to `@bapm/core` update. Unknown flags MUST remain hard errors. Help for `update` MUST document `-v`/`--verbose` and `--parallel-downloads` (including that `0` means serial). Existing `-y`/`--yes`, `--dry-run`, package scope, `--policy`/`--no-policy`, and non-TTY requiring `-y` MUST remain unchanged.

#### Scenario: Verbose short flag accepted on update
- **WHEN** `runCli(["update", "-v", "--dry-run"])` (or equivalent) runs in a valid project context
- **THEN** the CLI MUST NOT reject `-v` as unknown

#### Scenario: parallel-downloads zero accepted on update
- **WHEN** `runCli(["update", "--parallel-downloads", "0", "-y"])` or a dry-run path that exercises the flag is invoked
- **THEN** the CLI MUST NOT treat the flag as unknown and MUST pass serial concurrency into core

#### Scenario: Invalid parallel-downloads fails closed
- **WHEN** `runCli(["update", "--parallel-downloads", "nope"])` is called
- **THEN** the return code MUST be non-zero and a clear error MUST name the invalid value

#### Scenario: Update help lists polish flags
- **WHEN** update help is requested (`bapm update --help` or equivalent)
- **THEN** stdout MUST mention `-v`/`--verbose` and `--parallel-downloads` (including serial/`0` semantics)

#### Scenario: Unknown update flag still fails
- **WHEN** `runCli(["update", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and the error MUST name the unknown flag

### Requirement: Install exposes force insecure dev and only flags
The install command MUST accept `--force`, `--allow-insecure`, repeatable `--allow-insecure-host <hostname>`, `--dev`, and `--only <apm|mcp>`. Parsed values MUST be forwarded to `@bapm/core` install options. `--only` values other than `apm` or `mcp` MUST fail closed with a clear usage error. Invalid `--allow-insecure-host` hostnames MUST fail closed at parse. Unknown flags remain hard errors. Help MUST document these flags and MUST state that `--force` does not refresh refs and does not bypass frozen or policy. Help MUST NOT document `--refresh` in this change (deferred). Help MUST NOT conflate `--force` with `--target` / forced-target activation.

#### Scenario: New project-scope flags accepted
- **WHEN** `runCli(["install", "--force", "--allow-insecure", "--allow-insecure-host", "mirror.example.com", "--dev", "--only", "apm"])` is invoked in a valid parse context (flags alone or with a fixture that does not trip unrelated gates)
- **THEN** the CLI MUST NOT treat any of those tokens as unknown flags and MUST forward the corresponding options into core

#### Scenario: Invalid --only value rejected
- **WHEN** `runCli(["install", "--only", "lsp"])` (or any value other than `apm`/`mcp`) is called
- **THEN** the return code MUST be non-zero and no install mutation MUST occur

#### Scenario: Invalid allow-insecure-host rejected
- **WHEN** `runCli(["install", "--allow-insecure-host", "not a host"])` is called with a non-FQDN token
- **THEN** the return code MUST be non-zero before durable install writes

#### Scenario: Install help lists p7a flags
- **WHEN** install help is requested
- **THEN** stdout MUST mention `--force`, `--allow-insecure`, `--allow-insecure-host`, `--dev`, and `--only`, MUST note that `--force` does not refresh refs / bypass frozen or policy, and MUST NOT claim `--refresh` support

### Requirement: Install --dev positional uses CLI wiring
When install is invoked with `--dev` and positional package-ref add, the CLI MUST pass the dev flag so core writes `devDependencies.apm` per install-pipeline. Combining `--dev` with archive `.zip` positional MUST follow existing zip-vs-ref disambiguation (zip path is not a package-ref add).

#### Scenario: bapm install pkg --dev reaches core
- **WHEN** `runCli(["install", "owner/repo", "--dev"])` runs non-frozen without dry-run on a writable fixture
- **THEN** core install MUST receive the package ref and the dev flag so the add targets `devDependencies.apm`
