## Context

See proposal.md for motivation (Gap1 local `view` only). Today `deps list` / `tree` / `why` cover lock graph inspect; there is no top-level package metadata view. Core already has lock load, `whyDeps` query resolve (exact + short forms), and `locateGitPackageTree` for modules paths. APM `view` also supports `versions` / `--registry` / `-g` / marketplace — all deferred. CLI FEOD locked profile: new command = `commands/view` + `modules/View` + app registry.

## Goals / Non-Goals

**Goals:**

- Core public API for offline local package view (resolve → path → optional summary → text/result)
- Top-level FEOD `bapm view <package>` mirroring APM command name
- Reuse existing lock query resolve and modules-path location
- Behavioural acceptance only

**Non-Goals:**

- Remote versions / registry / global scope / marketplace plugin view / `--json` / Rich panels
- Nesting primary UX under `deps` (optional thin alias only if zero-cost later)
- CONFORMANCE edits; source-analysis acceptance

## Decisions

### D1 — Top-level `view`, not `deps view`

- **Choice:** Public command is `bapm view` (APM parity). Do not require `deps view` / `deps info` in this change.
- **Why:** Gap1 and user preference; FEOD already has many top-level lifecycle commands (`find`, `outdated`, …).
- **Alternatives:** Only `deps info` — rejected (APM renamed info→view at top level). Dual alias — defer; MAY add hidden `info` later.

### D2 — Core module: `View` (or thin Deps export)

- **Choice:** Prefer new `@b-apm/core` FEOD module `View` with public `viewPackage` / `runView`-style orchestration exported via `app/publicApi`. Internally reuse Lockfile load, shared resolve helpers from Deps (extract or import Deps public helpers if already exported), and `locateGitPackageTree` (or Lockfile public equivalent).
- **Why:** Keeps view formatting/orchestration out of the growing Deps why surface; mirrors Find vs Deps split.
- **Alternatives:** Add `viewDeps` inside Deps — acceptable if extract cost is high; still export a clear public symbol. Do not bury view only in CLI.

### D3 — Lock-first resolve (same forms as `deps why`)

- **Choice:** Resolve against lock first (exact name → exact repo_url → unique owner/repo → unique basename). Do not scan `apm_modules` directory layout as the primary resolver (APM org/repo folder scan differs from bapm’s identity-hashed modules dirs).
- **Why:** bapm modules layout is not always `org/repo`; lock identity is already shared with why/find.
- **Alternatives:** APM-style modules path scan first — rejected for bapm layout mismatch.

### D4 — Modules path + summary

- **Choice:** Path via existing locate-git-package-tree (or shared helper) under `apm_modules`. Summary = first non-empty of package manifest `summary` then `description` from dual-read `apm.yml`/`bapm.yml` under that tree when readable.
- **Why:** Matches MVP fields; APM shows `description`; user asked for summary-if-present.
- **Pin string:** `version` → `resolved_ref` → `resolved_tag` → short commit — same spirit as why’s version fallback.

### D5 — Exit codes 0 / 1 / 2

- **Choice:** Align with `find` / `deps why` (not APM’s ad-hoc exits alone).
- **Why:** Consistent consumer inspect UX in bapm.

### D6 — Reject `versions` positional and `--registry`

- **Choice:** Any extra positional (including `versions`) or `--registry` / `-g` → hard error non-zero in this change (honest “not supported” / unknown), not silent ignore.
- **Why:** Prevents false APM parity; keeps Gap1 remote work deferred.

### D7 — CLI FEOD wiring

- **Choice:** `packages/cli`: `COMMAND_VIEW`, `modules/View` (`createView`), `commands/view.ts`, registry + Help list. Soft IoC via existing lifecycle deps pattern.
- **Why:** Locked FEOD profile; same as Find/Search.

### D8 — Docs optional

- **Choice:** Short `apps/docs/reference/view.md` + sidebar entry as a SHOULD task; not required for accept green of core/CLI behavior.

### D9 — Acceptance behavioural only

- **Choice:** Acceptance asserts `runCli` / public core API outcomes (stdout/stderr/exit, fixture files). FORBIDDEN: reading CLI/core source, AST, or import graphs in acceptance.

## Risks / Trade-offs

- [Modules path missing while lock present] → Still succeed with identity+pin; message path unavailable (spec allows).
- [Local-path lock entries] → Reuse locate helper; if path missing, same honest unavailable path.
- [APM users expect `versions`] → Explicit reject + help says local-only; follow-up change for remote.
- [Duplicating why resolve] → Prefer shared helper extract over copy-paste; if extract is large, call into Deps public resolve if exposed, else minimal shared function under Deps consumed by View.

## Migration Plan

- Pure additive command + API; no lock/manifest format change.
- Rollback: unregister command and remove View module; no data migration.

## Open Questions

- None blocking; hidden `info` alias and `deps info` deferred without changing MVP specs.
