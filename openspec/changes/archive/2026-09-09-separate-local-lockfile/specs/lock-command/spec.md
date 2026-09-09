## ADDED Requirements

### Requirement: lock command partition-writes personal lock when needed

Invoking bare `lock` MUST use the same shared + personal partition write-back as core `resolveAndLock`. When the manifest includes bapm `local` sources, success MUST update `bapm.local.lock.yaml` for those pins and MUST keep shared-scope pins in the shared lockfile. When only shared-scope deps exist, behavior MUST match existing shared-only write rules. The command still MUST NOT deploy to harness targets.

#### Scenario: lock with local source updates personal lock

- **WHEN** `runCli(["lock"])` runs in a project whose manifest has a `local` source dependency and resolvable shared deps
- **THEN** exit code MUST be `0`, shared lock MUST exist for shared pins, and `bapm.local.lock.yaml` MUST contain the `local` pin
