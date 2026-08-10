# Cache

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Thin helpers over the project modules-cache root (`apm_modules`).

## Public API

- `cacheInfo` / `getCacheInfo` / `modulesCacheInfo` — root + entries + size
- `cacheClean` / `cleanModulesCache` — remove entries (`yes` / `-y` required)

## Invariants

- Does **not** introduce shared APM `~/.bapm` git/http cache
- Does **not** change rs-016 identity isolation for resolve/install
