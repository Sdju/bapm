# Cache

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Thin helpers over the project modules-cache root (`apm_modules`), plus the opt-in shared git mirror cache.

## Public API

- `cacheInfo` / `getCacheInfo` / `modulesCacheInfo` — root + entries + size (also exposes `shared` stats)
- `cacheClean` / `cleanModulesCache` — remove modules entries (`yes` / `-y` required)
- `sharedGitCacheInfo` / `sharedGitCacheClean` — shared mirror path/size and mirror-only wipe

## Invariants

- Default behavior stays project `apm_modules`; `BAPM_CACHE_DIR` opts into a shared mirror cache
- `BAPM_NO_CACHE=1` disables shared-cache use
- Shared clean never deletes `apm_modules`; modules clean never deletes shared mirrors
- Does **not** change rs-016 identity isolation for resolve/install
