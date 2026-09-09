## Context

See `proposal.md` for motivation. Today `packages/core` Pack `collectPackFiles` walks the project tree with hard excludes (`.git`, `node_modules`, `*.zip`, personal overlay/lock) then secret-refuse. Registry `buildPublishArchive` separately builds a flat zip: serialized wire `apm.yml`, recursive `.apm/**`, and optional root docs (`README.md`, `CHANGELOG.md`, `LICENSE`, `LICENSE.md`). Neither path consults an author ignore file. Specs: `pack-bapmignore`, deltas on `producer-pack-archive` / `producer-publish`.

## Goals / Non-Goals

**Goals:**

- One shared ignore loader/matcher used by Pack collect and Publish archive builders.
- Gitignore-compatible semantics familiar to npm authors (`.npmignore` analog).
- Fail-closed on unreadable ignore; always-include root dual-read manifests; always-omit `.bapmignore` itself.

**Non-Goals:**

- Implicit `.gitignore` filtering when `.bapmignore` is absent.
- Nested ignore files; per-run CLI override flags.
- Changing marketplace JSON emit or Agent Plugins portable pack layouts beyond the shared collect path if they already call `collectPackFiles`.

## Decisions

### Filename `.bapmignore` only (no `.apmignore`)

**Choice:** Exact basename `.bapmignore` at project root.

**Why:** Matches product brand; proposal non-goal for dual-brand rename. Authors already dual-read `bapm.yml`/`apm.yml`; ignore stays bapm-named.

**Alternatives:** Dual `.apmignore` — rejected for v1 scope. Manifest field `pack.ignore` — rejected (file is more npm-like and editable without YAML schema churn).

### Shared helper owned by Pack, reused by Registry

**Choice:** Implement load/match under Pack (e.g. `loadBapmIgnore(cwd)`, `isBapmIgnored(relPath, rules)`), export via Pack module / `publicApi` as needed; `buildPublishArchive` calls the same helper when including docs and walking `.apm/`.

**Why:** Single semantics; publish must not drift from pack. Pack already owns tree collection policy.

**Alternatives:** Duplicate matchers — rejected. New top-level `Ignore` FEOD module — deferred unless Pack grows more ignore surfaces.

### Matcher library via catalog (`ignore`)

**Choice:** Add the standard `ignore` npm package through the pnpm catalog / workspace dependency skill during apply (not hand-pinned versions). Wrap it so paths are project-root relative with `/`.

**Why:** Correct gitignore/`!` negation semantics without reinventing; same family as `.npmignore` tooling.

**Alternatives:** Hand-rolled glob subset — rejected (negation/dir edge cases). Use only transitive `picomatch` — weaker gitignore comment/`!` parity.

### Apply order in collect walk

**Choice:** For each candidate file: hard dir/basename excludes → if relative path (or ancestor dir) ignored by `.bapmignore`, skip silently → else secret-pattern check → else include. Prefer pruning ignored directories during walk when the directory itself matches.

**Why:** Ignored secrets must not refuse; performance on large `docs/` trees.

### Always-include manifests; fail-closed empty `.apm/` on publish

**Choice:** After ignore, force-include root `bapm.yml`/`apm.yml` when present on disk for pack. For publish, never skip writing wire `apm.yml`; if ignore removes every `.apm/**` member, fail with a clear Registry/Pack error (same class as missing `.apm/` today).

**Why:** npm always ships `package.json`; empty publish payload is worse than a loud failure when authors write `.apm/**`.

**Alternatives:** Fail when any always-include path is matched — noisier for `*` patterns. Silently publish empty `.apm/` — rejected.

### `--zip` does not re-filter

**Choice:** Document and keep: prebuilt upload path skips rebuild, so `.bapmignore` is not applied to members already inside the zip.

**Why:** Existing publish contract; authors who craft zips by hand own membership.

## Risks / Trade-offs

- **[Authors expect `.gitignore` to affect pack]** → Document opt-in `.bapmignore` only; note that pack still walks gitignored-but-present files unless listed.
- **[Over-broad `*` drops skill content]** → Always-include manifests + publish empty-`.apm` fail-closed; docs examples for README/CHANGELOG.
- **[New dependency weight]** → Small pure `ignore` package; catalog-managed.
- **[Publish docs list vs ignore]** → Apply ignore when copying each optional doc path so README omit works without special-casing the constant list.

## Migration Plan

1. Acceptance RED: omit docs via `.bapmignore` on pack/publish; negation; always-include manifest; ignored `.env` no refuse; empty `.apm` fail; missing file no-op.
2. Apply: catalog `ignore` → Pack helper → wire `collectPackFiles` + `buildPublishArchive` → docs/help.
3. Rollback = revert; projects without `.bapmignore` unchanged.

## Open Questions

_None._ Optional later: nested ignores; `--no-bapmignore`; adopting `.gitignore` as fallback.
