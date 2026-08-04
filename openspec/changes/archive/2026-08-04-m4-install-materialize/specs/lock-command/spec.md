## MODIFIED Requirements

### Requirement: lock does not claim install or target deploy
The `lock` command MUST NOT initialize targets, MUST NOT copy packages into harness dirs, and MUST NOT deploy primitives. After M4, `install` MAY deploy via registered targets, but `lock` MUST remain non-deploying and MUST NOT invoke target `materialize`.

#### Scenario: Harness dirs unchanged after lock
- **WHEN** `lock` succeeds on a fixture project that already contains cursor/agents-style dirs
- **THEN** those dirs MUST NOT gain new deployed primitive files from the lock command

#### Scenario: lock does not call target materialize
- **WHEN** `lock` runs in an environment where a target is registered for install e2e
- **THEN** the lock path MUST NOT invoke that target's materialize contract
