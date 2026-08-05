## ADDED Requirements

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
