## Context

See `proposal.md` for motivation. Today object APM deps accept `git` | `id` | `path` | `registry` | `marketplace` (`packages/core/src/modules/Manifest/parse.ts`); Resolver classifies object `path` / local string prefixes as `kind: local` with lexical project-root containment (`localPath.ts`, `mf-local-path-root-boundary`). There is no `.agents/local` convention and no gitignore ensure for local package roots. Install does not currently heal `.gitignore` for modules or local sources.

## Goals / Non-Goals

**Goals:**

- Parse `local` as a first-class source discriminator; expand default → `.agents/local`, custom string → that path; feed the existing local resolve path.
- Shared ensure-untracked helper used on resolve/install consume of `local` sources (append ignore if missing; fail if tracked).
- Keep OpenAPM `path:` code paths and Mode B claims untouched aside from accepting the new key in the discriminator allowlist.
- Document the extension on manifest guide + conformance boundary / README diffs.

**Non-Goals:**

- Claiming `local` in OpenAPM CONFORMANCE coverage tables.
- String-form `local:...` shorthand; `local` as `git` virtual_path companion.
- Auto-scaffolding packages under `.agents/local`.
- Changing containment to realpath/symlink-aware.

## Decisions

### Discriminator `local`, not a sugar rewrite of `path` at parse

**Choice:** Keep `local` on the object through parse; expand to an effective path at classify/resolve (and for gitignore ensure). Do not silently rewrite the manifest to `path:` on disk.

**Why:** Authors keep the intent (“this is the untracked local root convention”) distinct from portable OpenAPM `path:`. Round-trip write-back preserves `local`.

**Alternatives:** Parse-time rewrite to `path: .agents/local` — rejected (loses semantics and ensure trigger).

### Default value forms

**Choice:** Treat `local: true`, YAML `local:` / `null`, and `""` as default `.agents/local`. Reject `false` and non-scalars. Non-empty string = custom path.

**Why:** Matches natural YAML (`local:` / `local: true` / `local: ./alt`) without inventing a second key.

### Ensure runs on resolve/install, not bare parse

**Choice:** `parseManifestDocument` accepts shapes only. Gitignore ensure + tracked-file check run when resolving/installing a graph that includes at least one `local` source (same entrypoint as `resolveAndLock` / install resolve), after expansion and containment, before durable success.

**Why:** Parse/validate remain side-effect free (existing M1 contract). Ensure is a consumer safety gate, not a schema concern.

**Alternatives:** Ensure at parse — rejected (surprising writes). Doctor-only — rejected (too easy to commit tracked local trees during install).

### Gitignore ensure algorithm

**Choice:**

1. Compute effective absolute local root; confirm lexical containment (reuse `resolveLocalPath`).
2. If no `.git` in the project — still ensure/create project `.gitignore` with a covering pattern when missing (so a later `git init` stays safe); skip “already tracked” fail when git is absent.
3. If `.git` present — if `git ls-files` (or equivalent) reports tracked paths under the root → fail with guidance; else if not ignored (`git check-ignore -q` or pattern scan) → append a stable pattern (prefer `/.agents/local/` for default; for custom, a rooted relative pattern like `/alt-local/`).
4. Do not remove user comments or unrelated rules; append once.

**Alternatives:** Always fail instead of appending — rejected (poor UX). Force global `git update-index --assume-unchanged` — rejected (fragile, not ignore).

### FEOD placement

**Choice:** Manifest owns parse/types; Resolver owns classify expansion; small shared helper (Manifest or Install/common) for ensure-gitignore invoked from Resolver `resolveAndLock` / install path. No deep CLI imports; CLI unchanged except help/docs if needed.

**Why:** Matches existing FEOD boundaries; ensure is domain policy for local sources.

### Docs / conformance

**Choice:** Update `apps/docs/guide/config-manifest.md` examples; mention on conformance boundary page + README intentional diffs. Do **not** activate a new OpenAPM req id for `local`.

## Risks / Trade-offs

- **[Appending `.gitignore` surprises some users]** → Only when `local` sources are consumed; document clearly; never rewrite plain `path:` flows.
- **[Custom path already intentionally tracked]** → Fail closed with guidance; user can switch to `path:` if they want a tracked tree.
- **[No git binary / broken git]** → Prefer fail closed with diagnostic when `.git` exists but git cannot be queried; when no `.git`, append ignore only.
- **[Default `.agents/local` vs skills under `.agents/skills`]** → Different subtrees; ignore only the local root, not all of `.agents/`.

## Migration Plan

1. Acceptance RED for parse, resolve default/custom, gitignore ensure, tracked fail, `path:` regression.
2. Implement parse → classify expansion → ensure helper → wire resolve/install → docs.
3. Rollback = revert; no lockfile format migration. Existing manifests without `local` unchanged.

## Open Questions

_None._ Deferred niceties (string `local:` prefix, doctor heal-only command) can ship later without changing these requirements.
