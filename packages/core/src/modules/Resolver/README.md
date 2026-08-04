# Resolver

Transitive dependency classify, BFS resolve, modules-cache download, and lock populate for `@bapm/core`.

## Public API

| Export                                                                                        | Kind             |
| --------------------------------------------------------------------------------------------- | ---------------- |
| `classifyDependencyRef`, `resolveDependencyGraph`, `downloadPackages`, `resolveAndLock`       | functions        |
| `APM_MODULES_DIR` (`apm_modules`), `MAX_RESOLVE_DEPTH` (50), `DEFAULT_PARALLEL_DOWNLOADS` (4) | constants        |
| `ResolverError`                                                                               | errors           |
| `TagLister`, `GitRemote`, `Downloader`                                                        | injectable ports |

## M3 defaults

- **Modules dir:** `apm_modules` (APM wire parity; `bapm_modules` alias deferred)
- **Diamond policy:** OpenAPM **intersection-pick** (highest in ∩); **not** APM first-wins
- **Policy gate:** plan → gate → download (M8); see `@/modules/Policy`
- **Registry:** classify works; fetch fails closed as deferred/unsupported
- **Hash minimum:** git pins MUST include `resolved_commit` (40-hex) and `tree_sha256` (OpenAPM §5.6.4 / lk-015; `.git` excluded from walk)

## Example

```ts
import { resolveAndLock, APM_MODULES_DIR } from "@/modules/Resolver";

const result = await resolveAndLock({ cwd: ".", updateRefs: false });
// writes bapm.lock.yaml (or write-back) and materializes under APM_MODULES_DIR
```
