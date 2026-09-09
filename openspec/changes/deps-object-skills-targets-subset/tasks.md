## 1. Manifest parse and types

- [ ] 1.1 Type `ObjectDependency.skills` / `targets` as optional `string[]` (not `unknown`); keep `DEP_META_KEYS` allowlist
- [ ] 1.2 Add Manifest helper to parse/validate `skills:` (non-empty string list, dedupe/sort, reject traversal/absolute/empty) and `targets:` (non-empty mf-005 tokens via `isValidTargetToken`)
- [ ] 1.3 Call the helper from `validateApmEntry` for any object-form entry that sets those keys (`id:` and `git:` share it)
- [ ] 1.4 Unit-test parse accept/reject for registry `id:` and git object-form; serializeManifest round-trip keeps `id:` mapping (not `git:`)

## 2. Resolve carry-through

- [ ] 2.1 Add optional `skillSubset` / `targetSubset` on `ClassifiedDependency` and `ResolvedNode`; copy from object-form `raw` during classify
- [ ] 2.2 Ensure resolve/download still fetches the full package tree when a subset is present
- [ ] 2.3 Unit-test classify retains subsets for `id:` and `git:` without changing kind

## 3. Install materialize and identity merge

- [ ] 3.1 Filter skill primitives by per-dep `skillSubset` after discover; compose per-dep `targetSubset` with existing package/consumer intersection (do not overload package `declaredTargetIds`)
- [ ] 3.2 Emit a visible diagnostic when a non-empty skill subset matches zero available skills (req-mf-022); install MAY still succeed
- [ ] 3.3 Guard structured dependency merge / package-ref write-back: refuse replacing an `id:` entry with git-shaped YAML; identity-match `id: owner/repo` with string `owner/repo` so install does not append a git sibling (req-mf-024)
- [ ] 3.4 Tests: registry `id:` skills/targets materialize; git object-form same outcomes (git-longhand parity); mf-024 refuse git rewrite; empty-subset diagnostic

## 4. Docs and Mode B

- [ ] 4.1 Document object-form `skills:` / `targets:` on `- id:` (and `- git:`) in `apps/docs/guide/manifest-dependencies.md`; distinguish per-dep `targets:` from package top-level `targets:`
- [ ] 4.2 Claim `req-mf-024` active with citations; point `req-mf-022` at the empty-subset diagnostic test; run `conformance:gen` / `conformance:check`

## 5. Verification handoff

- [ ] 5.1 Leave behavioral coverage for acceptance (parse fail-closed, subset materialize, YAML object-form round-trip, registry-to-git refuse); do not park those suites only in apply ad-hoc tests without acceptance
- [ ] 5.2 Run targeted Manifest/Resolver/Install tests and `vp check` for touched packages before handoff
