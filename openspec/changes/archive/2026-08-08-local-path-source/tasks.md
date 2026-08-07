## 1. Manifest parse

- [x] 1.1 Add `local` to Manifest `ObjectDependency` / `SOURCE_KEYS` and validate allowed values (`true` | null/empty | non-empty string); reject `false` and bad types
- [x] 1.2 Enforce mutual exclusion: `local` alone as source kind (not with `git`/`id`/`path`/`registry`/`marketplace`); allow meta `alias` etc.; keep `path` companion only for `git`
- [x] 1.3 Extend Manifest unit tests for accept/reject shapes; confirm existing `path:` / marketplace fixtures still pass

## 2. Resolver classify and expand

- [x] 2.1 Classify object `local` as `kind: local` with effective path `.agents/local` (default) or the custom string
- [x] 2.2 Thread expansion through graph resolve before containment / manifest read; reuse `resolveLocalPath` for escapes
- [x] 2.3 Add Resolver unit tests: default, custom, escape, and regression that plain `path:` classify/resolve unchanged

## 3. Gitignore ensure for local roots

- [x] 3.1 Implement shared ensure-untracked helper (append covering `.gitignore` pattern; detect tracked paths under effective root when `.git` exists; actionable fail diagnostic)
- [x] 3.2 Invoke ensure from `resolveAndLock` / install resolve when the graph includes any `local` source; do not run for plain `path:`-only graphs
- [x] 3.3 Unit-test: missing ignore appended; custom root covered; tracked files fail closed; no-git still appends ignore; `path:`-only skips ensure

## 4. Docs

- [x] 4.1 Document `local` vs `path:` on `apps/docs/guide/config-manifest.md` (default `.agents/local`, custom path, gitignore ensure)
- [x] 4.2 Mention bapm-only `local` on conformance boundary page and root README intentional diffs

## 5. Verification

- [x] 5.1 Run targeted Manifest/Resolver/ensure unit suites green
- [x] 5.2 Confirm OpenAPM `path:` Mode B / existing local-path containment tests still green (no new OpenAPM claim for `local`)
