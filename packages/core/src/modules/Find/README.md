# Find

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Offline reverse lookup: which locked package(s) own a deployed workspace path.

## Public API

| Export                                      | Role                                              |
| ------------------------------------------- | ------------------------------------------------- |
| `buildReverseIndex`                         | Hash keys + list union → path → owners            |
| `lookupInIndex`                             | Normalize + exact / longest `/` directory prefix  |
| `formatFindOwnerLabel` / `formatFindOrigin` | Labels and `--source` origin                      |
| `findPath` / `runFind`                      | Load lock → index → lookup → format (exits 0/1/2) |

## Example

```ts
import { findPath } from "@b-apm/core";

const result = findPath({ cwd: process.cwd(), path: "AGENTS.md", source: true });
// result.exitCode: 0 | 1 | 2
```

Does **not** import Marketplace or perform network I/O. May use Lockfile + Deps (`whyDeps`).
