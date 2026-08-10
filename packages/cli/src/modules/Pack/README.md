# Pack

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

CLI module for `bapm pack` — thin wrapper over `@b-apm/core` `runPack` / `checkReleaseTag`.

## Public API

- `createPack(deps)` → `{ run, formatHelp }`
- Flags: `--archive`, `--dry-run`, `--check-release`, `--tag`
