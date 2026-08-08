## ADDED Requirements

### Requirement: Doctor accepts verbose flag

The `doctor` command MUST accept `-v` and `--verbose` without treating them as unknown flags. When either is present, CLI MUST pass verbose mode to the core doctor API. Doctor help (`-h` / `--help`) MUST document `-v, --verbose`. Unknown doctor flags other than `-v`, `--verbose`, `-h`, and `--help` MUST still hard-error with non-zero exit and a clear `Unknown doctor flag: …` message naming the token. Doctor MUST NOT perform harness deploy as part of the doctor path.

#### Scenario: Verbose short and long flags accepted

- **WHEN** `runCli(["doctor", "-v"])` or `runCli(["doctor", "--verbose"])` is invoked on a sane project with git available
- **THEN** the CLI MUST NOT treat the flag as unknown, exit MUST be `0` when critical checks pass, and output MUST include richer domain detail per `doctor-basics`

#### Scenario: Unknown doctor flag remains fail-closed

- **WHEN** `runCli(["doctor", "--not-a-flag"])` is invoked
- **THEN** the return code MUST be non-zero and the error MUST name `--not-a-flag` (wording `Unknown doctor flag: …`)

#### Scenario: Doctor help documents verbose

- **WHEN** `runCli(["doctor", "--help"])` or `runCli(["doctor", "-h"])` is invoked
- **THEN** the exit code MUST be `0` and help text MUST mention `-v` / `--verbose`
