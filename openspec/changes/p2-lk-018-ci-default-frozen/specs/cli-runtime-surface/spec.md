## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Install help documents supported flag subset
Invoking install help (`bapm install --help`, `bapm help install`, or the documented equivalent) MUST describe real install behavior and MUST document the supported flag subset for this change (at least `--frozen`, `--no-frozen`, and `--target` when implemented). Help MUST note that a truthy `CI` environment variable defaults install to frozen unless `--no-frozen` is passed. Help MUST NOT describe install as a permanent stub.

#### Scenario: Install help lists frozen and is not stub
- **WHEN** install help is requested
- **THEN** stdout MUST mention install behavior and `--frozen`, MUST NOT say install is a stub, and when `--target` is supported MUST document it

#### Scenario: Install help documents --no-frozen and CI default
- **WHEN** install help is requested
- **THEN** stdout MUST mention `--no-frozen` and MUST note that truthy `CI` defaults to frozen
