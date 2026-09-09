## ADDED Requirements

### Requirement: Install options accept trust-bin consent

Install public options MUST accept an explicit trust-bin consent mode equivalent to CLI `--trust-bin` / `--no-trust-bin` (and an unset/default mode). The option MUST be honored when deciding whether dependency/plugin `bin/` content may be materialized. Combining both force-allow and force-deny modes MUST be rejected before mutation when both are set.

#### Scenario: Trust-bin option forwarded from CLI

- **WHEN** core install runs with trust-bin consent set to allow for the invocation
- **THEN** bin deploy eligibility MUST follow the allow path subject to ExecutableTrust deny-wins for type `bin`

#### Scenario: No-trust-bin option skips bin materialize

- **WHEN** core install runs with trust-bin consent set to deny for the invocation and a dependency has deployable `bin/`
- **THEN** those bin files MUST NOT be written to deploy destinations

### Requirement: Bin deploy gated before materialize

When install discovers deployable `bin/` content under a dependency package (marketplace plugin or Agent Plugin package layout), it MUST evaluate bin trust (shared resolver for type `bin` plus invocation consent) before writing those binaries. Withheld or skipped bins MUST produce an inspectable diagnostic. Non-bin primitives for the same package MUST remain installable unless a separate gate fails.

#### Scenario: Withheld bin is not written

- **WHEN** bin trust evaluation withholds or skips a package's `bin/` and install would otherwise succeed
- **THEN** no file from that withheld `bin/` set MUST appear at the configured deploy destination for that package

#### Scenario: Allowed bin may materialize

- **WHEN** bin trust evaluation allows a package and a deploy destination is configured for that run
- **THEN** install MUST be allowed to write that package's `bin/` files to the destination
