## ADDED Requirements

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
