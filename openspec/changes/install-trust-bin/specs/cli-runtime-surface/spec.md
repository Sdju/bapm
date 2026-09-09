## ADDED Requirements

### Requirement: Install accepts trust-bin and no-trust-bin flags

The install command MUST accept `--trust-bin` and `--no-trust-bin` as known flags, forward the parsed consent into `@b-apm/core` install options, and MUST reject combining both in one invocation with a non-zero exit and a clear mutual-exclusion error. These flags MUST remain subject to the install unknown-flag hard-error rule for any other unknown token.

#### Scenario: --trust-bin is a known install flag

- **WHEN** `runCli(["install", "--trust-bin"])` runs on an otherwise valid project fixture
- **THEN** the CLI MUST NOT reject `--trust-bin` as an unknown flag and MUST forward trust-bin consent into core install

#### Scenario: --no-trust-bin is a known install flag

- **WHEN** `runCli(["install", "--no-trust-bin"])` runs on an otherwise valid project fixture
- **THEN** the CLI MUST NOT reject `--no-trust-bin` as an unknown flag and MUST forward no-trust-bin consent into core install

#### Scenario: Combining trust-bin flags fails at CLI

- **WHEN** `runCli(["install", "--trust-bin", "--no-trust-bin"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the conflict (or both flag names)

### Requirement: Install help documents trust-bin flags

Invoking install help MUST document `--trust-bin` and `--no-trust-bin`, including that they are per-invocation consent for marketplace/plugin `bin/` executables, that non-interactive installs default to not deploying bin without consent or persisted allow, and that the flags cannot override org/project deny.

#### Scenario: Install help lists trust-bin flags

- **WHEN** install help is requested
- **THEN** stdout MUST mention `--trust-bin` and `--no-trust-bin`

#### Scenario: Install help notes non-interactive bin default

- **WHEN** install help is requested
- **THEN** stdout MUST note that non-interactive (or CI/frozen) installs do not deploy bin by default without consent or policy allow
