# Lockfile

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Discover, load, validate, serialize, and compare OpenAPM/APM lockfiles (`apm.lock.yaml` / `bapm.lock.yaml`).

## Public API

| Export                                                                                                                                                                   | Kind      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `LockfileDocument`, `LockedDependency`, `LockfileInput`, `TreeSha256Violation`, …                                                                                        | types     |
| `LockfileError`, `LockfileErrorCode`                                                                                                                                     | errors    |
| `APM_LOCK_FILE`, `BAPM_LOCK_FILE`                                                                                                                                        | constants |
| `discoverLockfilePath`, `loadLockfile`, `loadLockfileOrNull`, `writeLockfile`, `parseLockfile`, `parseLockfileDocument`, `serializeLockfile`, `isSemanticallyEquivalent` | functions |
| `computeCanonicalTreeSha256`, `collectTreeSha256Violations`, `treeSha256Equal`, …                                                                                        | lk-015    |

Shared YAML safe-subset loading comes from `@/common/yaml/` (not Manifest internals).

## Example

```ts
import { loadLockfile, isSemanticallyEquivalent } from "@/modules/Lockfile";

const { document } = loadLockfile({ cwd: "." });
```
