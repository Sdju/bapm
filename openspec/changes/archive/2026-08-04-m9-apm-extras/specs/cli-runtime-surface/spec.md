## MODIFIED Requirements

### Requirement: Help command prints usage

Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`, `init`, `pack`, `compile`, and `cache` commands and MUST return exit code `0`. Help text for `install` MUST describe real install behavior (agentic dependency install), including consumption of a local pack archive path when supported, not a permanent stub disclaimer, and MUST be consistent with the install-help requirement for the supported flag subset. Help MUST mention the MCP path (install-time MCP and/or thin `mcp` command when registered). Lifecycle and producer commands MUST NOT be described as permanent stubs.

#### Scenario: help subcommand succeeds

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`, `init`, `pack`, `compile`, and `cache`, and the return code MUST be `0`

#### Scenario: default command is help

- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`

## ADDED Requirements

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
