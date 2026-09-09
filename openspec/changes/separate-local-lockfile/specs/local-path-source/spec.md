## ADDED Requirements

### Requirement: Local source pins write to the personal lockfile

When resolve/install/lock succeeds for a graph that includes at least one dependency using the bapm `local` source discriminator, durable lock pins for those dependencies MUST be written to `bapm.local.lock.yaml` per `lockfile-local-shared-split`, not retained in the shared team lockfile. OpenAPM `path:` dependencies MUST continue to lock into the shared lockfile and MUST NOT trigger personal-lock creation solely because their lock wire `source` is `local`.

#### Scenario: Bare local defaults pin personally

- **WHEN** the manifest declares `{ local: true }` (effective `.agents/local`) and `resolveAndLock` / install resolve succeeds
- **THEN** the resulting personal lock MUST contain that package pin and the shared lock MUST NOT

#### Scenario: Path source still shared

- **WHEN** the manifest declares only `path: ./pkgs/a` and resolve succeeds
- **THEN** the pin MUST land in the shared lockfile and `bapm.local.lock.yaml` MUST NOT be required

### Requirement: Ensure personal lockfile is gitignored with local sources

In addition to ensuring the effective local package root is untracked, when resolve/install/lock consumes a `local` source and writes or updates `bapm.local.lock.yaml`, the system MUST ensure a covering gitignore rule for `bapm.local.lock.yaml` exists (append when missing). The existing fail-closed behavior when the local package root is already tracked MUST remain.

#### Scenario: Personal lock ignore appended with local consume

- **WHEN** resolve/install consumes `{ local: true }` and writes `bapm.local.lock.yaml`, and ignore rules lack that filename
- **THEN** the system MUST add a covering ignore entry for `bapm.local.lock.yaml` before succeeding
