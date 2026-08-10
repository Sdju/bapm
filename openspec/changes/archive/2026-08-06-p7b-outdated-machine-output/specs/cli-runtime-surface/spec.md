## ADDED Requirements

### Requirement: outdated accepts parallel-checks and json flags

The `outdated` command MUST accept `-j <n>` and `--parallel-checks <n>` (and `=<n>` forms consistent with other parallel CLI flags) as equivalent ways to set remote-check concurrency. When the flag is omitted, CLI MUST apply default **4**. Value **`0` MUST mean serial**. Invalid or missing numeric values MUST fail with non-zero exit and a clear error. Parsed concurrency MUST be forwarded to `@b-apm/core` outdated. The command MUST also accept `--json` (long form only): when set, success MUST write stable JSON of existing outdated rows to stdout and MUST NOT print the human table/text; errors MUST go to stderr (same posture as `deps why --json` / `policy status --json`). Combining `--json` with `-j` / `-v` MUST be allowed; JSON wins over human text. **`-j` MUST NOT enable JSON** (APM binds `-j` to parallel-checks only). Help MUST document `-j` / `--parallel-checks` (default 4 / `0` serial) and `--json` as bapm machine output of real rows — MUST NOT claim APM has `outdated --json`. Unknown flags MUST remain fail-closed. Exit policy from `lifecycle-outdated` MUST remain unchanged. JSON MUST use only fields already computed on rows (`name`, `status`, `current`, `latest`, optional `repo_url` / `tip_ref` / `detail`); inventing APM-only keys such as marketplace/registry `source` is FORBIDDEN.

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
