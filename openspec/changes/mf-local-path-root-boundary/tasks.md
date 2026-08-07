## 1. Acceptance coverage (RED)

- [ ] 1.1 Add an isolated acceptance suite for `mf-local-path-root-boundary` that asserts all seven explicit string prefixes and object `{ path }` classify as local.
- [ ] 1.2 Add RED graph fixtures for POSIX-normalized in-root paths, direct and transitive in-root siblings, and direct/transitive POSIX and backslash escapes; assert error code and original-path diagnostics.
- [ ] 1.3 Add RED side-effect assertions proving a rejected edge does not probe/read its target, invoke downloader/git/registry/marketplace paths, enter policy/materialization, or write a lockfile.

## 2. Resolver root-boundary implementation

- [ ] 2.1 Extend Resolver local-string classification for the required POSIX and backslash prefixes while retaining object-path precedence and existing non-local classifications.
- [ ] 2.2 Add a focused lexical local-path normalizer/resolver that converts separators, expands home syntax, resolves from `fromDir`, and checks normalized containment against the project root.
- [ ] 2.3 Integrate the boundary check before filesystem reads and other local-edge side effects; retain correct transitive `fromDir` propagation and in-root normalization.
- [ ] 2.4 Add and export `LOCAL_PATH_ESCAPES_PROJECT_ROOT` in Resolver error/type surface with original path and boundary diagnostic details.

## 3. Durable tests and Mode B claim

- [ ] 3.1 Promote resolver classification, in-root, escape, transitive, and no-side-effect coverage into durable `packages/core/tests/resolve` / `spec-conformance` suites; remove the temporary acceptance suite.
- [ ] 3.2 Add or update the Mode B fixture/citation for `req-mf-016`, mark it `active` in `tests/spec-conformance/checklist.yml`, and remove its skipped waiver rationale.
- [ ] 3.3 Regenerate `CONFORMANCE.md` and `CONFORMANCE.json`; run `pnpm run conformance:check` and focused resolver/conformance tests.
