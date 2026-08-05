## 1. Lock model + resolve emit

- [x] 1.1 Add first-class optional `resolved_ref` on LockedDependency / resolve node types as needed
- [x] 1.2 Carry classified git ref through resolve graph into `buildLockDocument`
- [x] 1.3 Emit `resolved_ref` for git-literal (branch/tag/SHA/`HEAD`) and git-semver (`resolved_ref` = picked tag when known)
- [x] 1.4 Ensure load→serialize preserves `resolved_ref` (including APM-written locks); update unit/fixture expectations that assert lock YAML shape

## 2. Outdated algorithm

- [x] 2.1 Stop using `inferConstraintFromTag`; only enter semver/tag-lister path when lock `constraint` is present
- [x] 2.2 For non-constraint pins: tip via `gitRemote.resolveRef(url, resolved_ref)` with order lock `resolved_ref` → manifest pin → `HEAD`
- [x] 2.3 Keep local skip without network; exit 0 with outdated rows; missing lock → error; no project writes
- [x] 2.4 Add optional verbose detail on core result (chosen tip / skip reasons / candidates) without breaking default row text contract
- [x] 2.5 Unit-test branch tip ≠ HEAD, HEAD up-to-date, no invented `^`, constraint semver path, local skip (injectable ports)

## 3. CLI surface

- [x] 3.1 Parse `-v` / `--verbose` on `outdated`; wire to core; unknown flags still fail-closed
- [x] 3.2 Update outdated help: verbose flags + report-only vs `update`
- [x] 3.3 SHOULD (if cheap): `--parallel-checks`/`-j` and/or `--json`; otherwise skip without blocking DoD

## 4. Acceptance + docs hygiene

- [x] 4.1 Acceptance: branch pin reports tip of that branch (fake `gitRemote`); HEAD/default still works
- [x] 4.2 Acceptance: semver outdated/up-to-date with `constraint`; tag-only without constraint does not invent `^`
- [x] 4.3 Acceptance: missing lock non-zero; exit 0 with outdated rows; cwd tree bit-identical after outdated (± verbose)
- [x] 4.4 Acceptance: fresh lock/install writes `resolved_ref` for git-literal; update command behavior unchanged
- [x] 4.5 Knowledge/roadmap note P6e in flight; **no** CONFORMANCE claim-table edits
