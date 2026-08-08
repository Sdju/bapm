## ADDED Requirements

### Requirement: Update plan verbosity gates keep rows

When update prints a human plan (including `--dry-run`), without verbose the printed text MUST omit rows whose action is `keep` (APM-aligned quieter plan). With verbose enabled, keep rows MUST appear using the existing `[=] … keep` form (or equivalent). Internal plan computation MAY still include keep entries. When every planned row is keep (or the printed set is empty after gating), messaging MUST remain honest — MUST NOT claim packages were updated. Verbose MUST NOT change dry-run non-mutation, confirm/`-y`, policy, or lock rewrite semantics.

#### Scenario: Dry-run without verbose hides keep

- **WHEN** update runs with `--dry-run` and without verbose, and the plan includes one or more `keep` entries plus zero or more non-keep entries
- **THEN** printed plan text MUST NOT contain keep/`[=]` lines for unchanged deps, and lock/modules MUST remain unchanged

#### Scenario: Dry-run with verbose shows keep

- **WHEN** update runs with `--dry-run` and verbose enabled, and the plan includes `keep` entries
- **THEN** printed plan text MUST include keep/`[=]` lines for those unchanged deps

#### Scenario: All-keep plan stays honest without verbose

- **WHEN** update runs with `--dry-run` without verbose and every planned entry is `keep`
- **THEN** output MUST indicate no dependency changes (or equivalent honest empty-change messaging) and MUST NOT imply an update was applied

### Requirement: Update accepts parallel downloads option

Update public options MUST accept `parallelDownloads` aligned with install/APM: default **4** when omitted; **0** means serial (no parallelism). The value MUST be forwarded into the resolve/download path used by mutating update. Invalid values MUST be rejected by the CLI layer (non-zero) when supplied via flags. Parallel downloads MUST NOT weaken frozen refusal, policy gate, or dry-run non-mutation.

#### Scenario: Default concurrency when omitted

- **WHEN** mutating update runs without an explicit parallel-downloads value
- **THEN** resolve/download MUST use concurrency **4** (or the documented APM-aligned default)

#### Scenario: Zero means serial

- **WHEN** update is invoked with parallel downloads set to `0` on a path that reaches resolve
- **THEN** the invocation MUST NOT fail as an unknown option and MUST treat downloads as serial
