# Lock

Thin CLI module wrapping `@bapm/core` `resolveAndLock` for `bapm lock`.

## Public API

- `createLock(deps)` — soft IoC factory
- `parseLockArgs` — `--update`, `--verbose`/`-v`, `--parallel-downloads`, `--policy`, `--no-policy`

Policy gate runs via core `resolveAndLock` (plan → gate → download) before lock write.
