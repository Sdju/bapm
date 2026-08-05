# Deps

Lock-backed inspect: `listDeps`, `treeDeps`, and offline `whyDeps` (rs-005) via `resolved_by` / nested edges.

`whyDeps` returns structured `package` + `paths`, honest exits (`0` / `1` not_installed|ambiguous / `2` no_lockfile), and matches exact lock `name` or `repo_url`.
