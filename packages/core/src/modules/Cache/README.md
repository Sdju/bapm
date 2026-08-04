# Cache

Thin helpers over the project modules-cache root (`apm_modules`).

## Public API

- `cacheInfo` / `getCacheInfo` / `modulesCacheInfo` — root + entries + size
- `cacheClean` / `cleanModulesCache` — remove entries (`yes` / `-y` required)

## Invariants

- Does **not** introduce shared APM `~/.bapm` git/http cache
- Does **not** change rs-016 identity isolation for resolve/install
