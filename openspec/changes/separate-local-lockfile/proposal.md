## Why

Today the project has a single lockfile (`bapm.lock.yaml` / `apm.lock.yaml`). Pins and deploy inventory for the bapm `local` source (default `.agents/local` and personal WIP) land in that same file, so personal churn shows up in the shared lock that teams commit and CI freezes. Manifest already has a personal overlay (`bapm.local.yml`); lock needs a first-class personal counterpart so shared lock stays team-stable.

## What Changes

- Introduce a **personal/local lockfile** beside the project root (`bapm.local.lock.yaml`) that holds lock entries originating from the bapm `local` source discriminator (and their deploy inventory), separate from the **shared/team lockfile**.
- Resolve / `lock` / `install` / `update` / uninstall / prune paths **partition write-back**: shared deps → shared lock; `local`-sourced deps → local lock. Consumers that need the full graph **merge** both documents in memory.
- Keep OpenAPM `path:` local packages in the **shared** lock (they remain team-vendored). Do **not** move top-level `local_deployed_*` bags into the personal file (those names mean unattributed deploy inventory, not personal WIP).
- Treat the personal lock like `bapm.local.yml`: gitignore ensure, pack/publish omit, doctor warn if tracked; absence is success when no `local` sources are in the graph.
- **Migration:** on the next lock-writing resolve, strip `local`-sourced entries out of the shared lock into the personal lock (no separate CLI migrate command in v1).
- Docs: lockfile guide + overlay/local-source callouts describing the split and commit rules.

Non-goals:
- Allowing `dependencies` in `bapm.local.yml` (still settings-only overlay).
- Changing OpenAPM lock schema version or inventing a second lock schema for the personal file (same YAML schema, different filename + partition rules).
- Dual-brand `apm.local.lock.yaml` / APM parity for the personal lock in v1.
- Splitting `apm_modules/` or harness deploy roots by lock scope.

## Capabilities

### New Capabilities

- `lockfile-local-shared-split`: discover/load/merge/write partition between shared team lock and personal `bapm.local.lock.yaml`; identity conflict rules; gitignore / unpublished / migration behavior.

### Modified Capabilities

- `lockfile-dual-file-discovery`: shared dual-read (`apm.lock.yaml` / `bapm.lock.yaml`) remains; clarify that personal lock is a third, separate artifact (not part of the brand dual-conflict matrix).
- `local-path-source`: resolve/install that consume `local` MUST write pins to the personal lock, not the shared lock; gitignore ensure extended to cover the personal lockfile name.
- `dependency-resolve`: `resolveAndLock` dual-write / merged effective lock document.
- `lock-command`: `bapm lock` participates in partition write-back and merge load.
- `doctor-basics`: warn when `bapm.local.lock.yaml` is git-tracked (mirror overlay warning).
- `producer-pack-archive`: omit personal lock from pack archives.
- `producer-publish`: omit personal lock from publish archives.

## Impact

- `@b-apm/core` Lockfile + Resolver (`resolveAndLock`), Install/Update/Uninstall/Prune, Deps/View/Audit/Find consumers that load “the” lock, Doctor, Pack/Publish collectors.
- CLI help / Policy defaults may surface the personal lock basename; no new user-facing command required in v1.
- Docs under `apps/docs/guide` (lockfile, local source / overlay).
- Existing fixtures that put `source: local` path packages in a single lock remain valid for shared OpenAPM `path:` cases; fixtures using discriminator `local` / `.agents/local` need dual-file expectations after apply.
