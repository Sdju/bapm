## Context

See proposal.md for motivation. Today Install records `deployed_file_hashes` / `local_deployed_file_hashes` via `applyDeployedHashesToLock` (`packages/core/src/modules/Install/deployedInventory.ts`). Lock types already allow `deployed_files` / `local_deployed_files`, but Install does not systematically dual-write lists. `whyDeps` already provides offline reverse dependency chains. CLI has no `find` module. Marketplace phases are orthogonal — find must not call Marketplace resolve/search/fetch.

APM reference: `commands/find.py` (`build_reverse_index`, `_lookup_in_index`, `_format_origin`, `_render_why`), exits 0/1/2, flags `--source` / `--path`.

## Goals / Non-Goals

**Goals:**

- Core `Find` FEOD module: reverse index + lookup + orchestration + label/origin/`--path` formatting.
- Top-level CLI `bapm find` mirroring APM UX on bapm locks (hash keys primary).
- Optional S1 dual-write lists in Install when cheap.
- Acceptance + unit tests covering G1–G7.

**Non-Goals:**

- Network, marketplace, CONFORMANCE claim edits, `find --json`, nested `marketplace find`, attribution heuristic upgrades, changing hash algo / orphan cleanup.

## Decisions

### D1 — Core module location: `modules/Find`

- **Choice:** New `@bapm/core` FEOD module `Find` (not buried only inside Install).
- **Why:** Reverse lookup is a read-only lock query surface, orthogonal to Install mutation and to Marketplace. Keeps public API clear (`buildReverseIndex`, `lookupInIndex`, `findPath` / `runFind`-style orchestration).
- **Alternatives:** Helpers under Lockfile (inventory is lock-shaped but find UX/formatting is product behavior); under Deps (why reuse only) — rejected to avoid bloating those modules.

### D2 — Index primary source: hash-map keys (+ list union)

- **Choice:** Index every key of `deployed_file_hashes` / `local_deployed_file_hashes`; if `deployed_files` / `local_deployed_files` exist, union those paths with the same owners.
- **Why:** Matches current bapm Install output; APM-shaped locks that only have lists still work; S1 dual-write is non-blocking.
- **Alternatives:** Require lists only (breaks hash-only locks); invent a second inventory format — forbidden by criteria.

### D3 — Owner key and label (product D6)

- **Choice:** Owner key = lock dependency identity used elsewhere (prefer stable key aligned with Deps/`packageKey` / `repo_url`||`name`); stdout label = `repo_url` if set else `name`; workspace = `"."`.
- **Why:** APM prints `repo_url`; criteria D6 locked.
- **Note:** When `name` and `repo_url` diverge, label follows D6 (`repo_url` wins); document in help if needed — do not invent a third id.

### D4 — Multi-owner order: first-seen (S3 deferred)

- **Choice:** Preserve first-seen order from lock `dependencies[]` encounter, then local. Depth-stable sort (APM `get_all_dependencies`) is SHOULD S3 — acceptable v1 without extra sort.
- **Why:** Simpler; matches “first-seen from serialized dep order is acceptable v1” in criteria.

### D5 — `--path` via `whyDeps`; root label `bapm.yml`

- **Choice:** Call existing `whyDeps` with owner query (`name` or `repo_url`); render indented chains. Prefer walker/project text using **`bapm.yml`** (or existing whyDeps chain text) over copying APM's `apm.yml` literal.
- **Why:** Criteria open question resolved for plan; avoids false APM branding in bapm output.

### D6 — Origin formatter priority (APM parity)

- **Choice:** Port APM priority: `oci://` resolved_url → local_path → repo@resolved_ref → repo@resolved_tag → repo@commit[:12] → repo_url; workspace `.  (workspace)`.
- **Map** to existing lock fields (`resolved_url`, `path`/`local_path`, `resolved_ref`, `resolved_tag`, `resolved_commit` / commit fields as present on `LockedDependency`). If a field is absent, skip that tier.

### D7 — CLI FEOD: `modules/Find` + `commands/find`

- **Choice:** Mirror Search: thin command → `createFind` module → `@bapm/core` find API. Register in app registry; Help lists `find`.
- **Flags:** `--source`, `--path` only for v1 (`--json` OOS).

### D8 — S1 dual-write in same change

- **Choice:** Implement S1 in Install `applyDeployedHashesToLock` (when writing a hash key, also ensure path is in the parallel list field). Keep orphan cleanup keyed on hashes.
- **Why:** Criteria allow picking S1 if Install touch is small; closes research Q5 without blocking find.

### D9 — Soft OpenAPM note only

- **Choice:** No CONFORMANCE.md / `req-sc-*` edits. Design may note find as consumer UX parity, non-normative.

## Risks / Trade-offs

- [Hash-only locks without S1] → Index still works via hash keys; list union is additive.
- [Shared AGENTS.md multi-owner] → Print all owners; do not “improve” attribution beyond inventory.
- [whyDeps query ambiguity] → Prefer exact `repo_url` then `name` for the matched owner; if why fails empty, fall back to label (spec).
- [Directory keys rare today] → Prefix lookup still required for APM parity / future S2.

## Migration Plan

- Pure additive CLI + core API; existing installs keep working.
- After S1, new installs gain list fields; old locks remain findable via hashes.
- Rollback: remove Find module/command; leave dual-write harmlessly or revert Install hunk.

## Open Questions

None blocking. Deferred product: `find --json`, S3 depth-stable sort, authoring track after archive.
