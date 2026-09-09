## Context

See `proposal.md` for motivation. Today Lockfile dual-read discovers one shared brand file (`apm.lock.yaml` | `bapm.lock.yaml`); `resolveAndLock` / install write a single document. Path-local and bapm `local` discriminator packages both emit lock wire `source: local` / `repo_url: local:…`, so filename alone cannot distinguish team-vendored `path:` from personal `.agents/local` WIP. Manifest already has personal overlay (`bapm.local.yml`); gitignore ensure already exists for local package roots (`local-path-source`).

## Goals / Non-Goals

**Goals:**

- Stamp or classify resolve nodes by **manifest provenance** (`local` discriminator vs `path`) so partition survives wire `source: local` ambiguity.
- Central merge + dual-write helpers used by resolve/install/update/uninstall paths and by read-only lock consumers.
- Mirror overlay unpublished / doctor / gitignore patterns for `bapm.local.lock.yaml`.
- Lazy migrate legacy personal-scope rows out of the shared lock on next write.

**Non-Goals:**

- New lock schema version or different validation rules per file.
- `apm.local.lock.yaml` brand dual-read.
- Splitting modules cache or harness trees by lock scope.
- Allowlisting `dependencies` inside `bapm.local.yml`.

## Decisions

### Filename `bapm.local.lock.yaml`

**Choice:** Exact basename parallel to `bapm.local.yml`; refuse `apm.local.lock.yaml` in v1.

**Why:** Predictable personal surface; avoids expanding shared dual-conflict matrix to four files.

**Alternatives:** Nested `.agents/local/bapm.lock.yaml` — rejected (harder discovery, couples to default root only). `bapm.lock.local.yaml` — rejected (less parallel to overlay naming).

### Provenance stamp at resolve, not path heuristics alone

**Choice:** When classifying/expanding a dependency that used discriminator `local`, mark the resolved node (and emitted lock entry) as personal-scope (e.g. retained field such as `x-bapm-lock-scope: local` **or** an internal-only bit carried through write partition without requiring authors to edit YAML). Prefer a durable on-disk marker on personal-lock entries so reload/migrate stays deterministic even if the manifest later drops the declaration mid-read. Shared `path:` locals omit the marker.

**Why:** Lock wire already uses `source: local` for both kinds; path-equality to `.agents/local` fails for custom `local: ./alt` and wrongly catches intentional shared trees that happen to live there.

**Alternatives:** Partition every `source: local` lock row — rejected (breaks shared `path:`). Path-prefix heuristics only — rejected (custom roots + false positives).

### Merge API surface

**Choice:** Add Lockfile helpers: discover/load personal lock (nullable), `mergeLockDocuments(shared, personal) → effective` with identity/`name` conflict errors, and `partitionAndWrite(effectiveOrGraph, …)` used by `resolveAndLock` / install writers. Read APIs that today call `loadLockfile` for “the project lock” gain a merge-load entrypoint (or options flag) so Deps/View/Audit/Find/frozen do not each reimplement merge.

**Why:** Single partition policy; FEOD Lockfile owns files, Resolver owns when to write after graph build.

### Inventory bags stay on shared document

**Choice:** Top-level `local_deployed_*`, `mcp_*`, deployments, `x-*` carry-forward remain on the **shared** document. Personal lock is primarily a `dependencies` list (+ version/metadata as needed for valid documents). Per-dependency `deployed_file_hashes` for personal-scope packages live on those personal entries.

**Why:** Avoid renaming confusion; team CI frozen/audit inventory stays in the committed file.

### Legacy read vs write

**Choice:** On merge-load, if personal file absent, treat shared-lock rows that carry personal-scope marker **or** that match current manifest `local` identities as personal-scope for the effective graph. On next successful write, emit them only into `bapm.local.lock.yaml` and strip from shared.

**Why:** No forced one-shot migrate CLI; old checkouts keep working until someone locks.

### CI / frozen

**Choice:** Frozen and CI continue to require the **shared** lock for shared-scope pins. Missing personal lock in CI is success when the manifest under test has no `local` sources (typical CI). If CI manifests intentionally include `local`, they must supply personal lock in the environment (usually discouraged); document that team manifests should keep `local` WIP off CI-critical paths when possible.

**Why:** Matches “personal file is gitignored” model.

### FEOD / packages

**Choice:** Core Lockfile + Resolver + thin call-site updates in Install/lifecycle/Doctor/Pack/Publish. CLI unchanged except docs/help strings if lock basename is shown. Docs: lockfile guide + local-source / overlay cross-links.

## Risks / Trade-offs

- **[Wire `source: local` ambiguity]** → Provenance stamp / scope marker; tests for both `path:` and `local` discriminator.
- **[Half-written dual files on crash]** → Write personal then shared (or temp+rename both); fail closed if either write fails after the other began — document best-effort ordering; prefer atomic replace per file already used by writeLockfile.
- **[Consumers forgetting merge-load]** → Shared helper; grep call sites of `loadLockfile` / `loadLockfileOrNull` in apply tasks.
- **[Name collision shared vs personal]** → Fail closed on merge; forces authors to alias or rename.
- **[Doctor/pack drift vs overlay]** → Copy patterns from `bapm.local.yml` handling to reduce surprise.

## Migration Plan

1. Acceptance RED for partition write, merge load, legacy migrate, gitignore, doctor, pack/publish omit, `path:` regression.
2. Implement Lockfile merge/partition → stamp in Resolver → wire writers/readers → doctor/pack/publish → docs.
3. Rollback = revert; legacy single-file locks remain readable; no schema version bump.

## Open Questions

_None._ Optional later: CLI `--local-lockfile` path override; allowing personal deps in `bapm.local.yml`.
