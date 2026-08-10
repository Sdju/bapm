# Deps

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Lock-backed inspect: `listDeps`, `treeDeps`, and offline `whyDeps` (rs-005) via `resolved_by` / nested edges.

`whyDeps` returns structured `package` + `paths`, honest exits (`0` / `1` not_installed|ambiguous / `2` no_lockfile), and matches exact lock `name` or `repo_url`.

Shared `resolvePackageQuery` (exact → owner/repo → basename) is also used by the View module.
