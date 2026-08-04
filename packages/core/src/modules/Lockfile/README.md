# Lockfile

Discover, load, validate, serialize, and compare OpenAPM/APM lockfiles (`apm.lock.yaml` / `bapm.lock.yaml`).

## Public API

| Export                                                                                                                                                                   | Kind      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `LockfileDocument`, `LockedDependency`, `LockfileInput`, …                                                                                                               | types     |
| `LockfileError`, `LockfileErrorCode`                                                                                                                                     | errors    |
| `APM_LOCK_FILE`, `BAPM_LOCK_FILE`                                                                                                                                        | constants |
| `discoverLockfilePath`, `loadLockfile`, `loadLockfileOrNull`, `writeLockfile`, `parseLockfile`, `parseLockfileDocument`, `serializeLockfile`, `isSemanticallyEquivalent` | functions |

Shared YAML safe-subset loading comes from `@/common/yaml/` (not Manifest internals).

## Example

```ts
import { loadLockfile, isSemanticallyEquivalent } from "@/modules/Lockfile";

const { document } = loadLockfile({ cwd: "." });
```
