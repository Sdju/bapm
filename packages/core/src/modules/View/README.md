# View

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Offline local inspect of one installed lock package: identity, pin, modules path, optional summary.

## Public API

| Export                    | Role                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `viewPackage` / `runView` | Load lock → resolve query → locate tree → format (exits 0/1/2) |

## Example

```ts
import { viewPackage } from "@b-apm/core";

const result = viewPackage({ cwd: process.cwd(), package: "acme/shared-utils" });
// result.exitCode: 0 | 1 | 2
```

Uses Lockfile + Deps resolve helpers + Manifest dual-read under the modules tree. No network.
