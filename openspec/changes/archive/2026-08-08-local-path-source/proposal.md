## Why

Authors often keep WIP / machine-local APM packages beside the project without wanting them in git. OpenAPM `path:` already supports in-tree local packages, but it does not give a conventional default root under `.agents/` or guarantee that root stays untracked. bapm needs a **bapm-only** `local` source that behaves like `path:` with a safe default and fail-closed gitignore guidance, without changing OpenAPM `path` semantics.

## What Changes

- Add object-form source discriminator **`local`** on `dependencies.apm` / `devDependencies.apm` entries (bapm extension; not an OpenAPM wire claim).
- **`local` with no custom path** (empty / null / boolean `true`) resolves like `path:` to project-relative **`.agents/local`**.
- **`local: <path>`** resolves like `path:` to that custom location (same project-root containment as existing local paths).
- On resolve/install (and equivalent consume paths that materialize or read the local source), **ensure the effective local root is gitignored**; if git already tracks files under it, **fail closed** with actionable guidance (`git rm --cached`, gitignore pattern).
- Existing OpenAPM **`path:`** (string prefixes and object `path`) MUST remain unchanged in parse, classify, resolve, and Mode B claims.
- Docs: document `local` as a bapm extension vs OpenAPM `path` on the manifest guide / intentional-diff surfaces.

**Non-goals:**

- Changing OpenAPM Mode B / `path` conformance claims or inventing `local` as OpenAPM vocabulary.
- Symlink realpath containment beyond the existing lexical root boundary.
- Auto-creating package scaffolds under `.agents/local` (authors create packages themselves).
- Ignoring unrelated paths; rewriting user `.gitignore` beyond appending the needed ignore rule when safe.
- String-form `local:...` shorthand (object form only for MVP).
- Using `local` as a companion to `git` (virtual_path stays `path` only).

## Capabilities

### New Capabilities

- `local-path-source`: bapm `local` source discriminator — default root `.agents/local`, optional custom path, normalize to path-like local resolve, and ensure-untracked / fail guidance for the effective local root.

### Modified Capabilities

- `manifest-yaml-validate`: Accept `local` as a mutually exclusive object source kind alongside `git` | `id` | `path` | `registry` | `marketplace`; reject unknown combinations with `local`.
- `dependency-resolve`: Classify and resolve `local` entries as `kind: local` with the default or custom path; preserve existing `path` behavior.
- `docs-openapm-boundary`: Record `local` as an intentional bapm extension (not OpenAPM / not full APM CLI parity).

## Impact

- `@b-apm/core` Manifest parse/types: `local` on `ObjectDependency`; validation of source kinds.
- `@b-apm/core` Resolver classify/graph: map `local` → local path (default `.agents/local`); reuse existing root containment.
- `@b-apm/core` Install/resolve consume path (or small shared helper): gitignore ensure + tracked-file fail guidance for effective local roots.
- `apps/docs` manifest guide (+ conformance boundary mention).
- Acceptance: parse shapes, default vs custom path resolve, gitignore ensure, tracked fail, `path:` unchanged regression.
