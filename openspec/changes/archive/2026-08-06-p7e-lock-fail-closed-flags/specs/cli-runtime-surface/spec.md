## ADDED Requirements

### Requirement: Lock unknown flags hard-error

The `lock` command MUST reject unrecognized flags on the bare resolve+write path with a non-zero exit code and a clear error message naming the unknown flag. Soft-ignoring unknown flags MUST NOT occur. Behavior details and known allowlist follow the `lock-command` capability.

#### Scenario: Unknown lock flag rejected at CLI

- **WHEN** `runCli(["lock", "--not-a-real-flag"])` is invoked
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag
