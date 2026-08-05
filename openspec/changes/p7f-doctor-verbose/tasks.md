## 1. CLI verbose wire (G1)

- [ ] 1.1 In `parseDoctorArgs`, accept `-v` / `--verbose` → `verbose: true`; keep `-h`/`--help`; other `-…` → `Unknown doctor flag: ${arg}`
- [ ] 1.2 Pass `verbose` from CLI into `coreRunDoctor({ cwd, verbose })`
- [ ] 1.3 Update `formatDoctorHelp` to document `-v, --verbose` (and network/auth only if those probes ship)

## 2. Core verbose domain detail (G2–G4)

- [ ] 2.1 Add `verbose?: boolean` to `RunDoctorOptions`; keep critical exit semantics unchanged
- [ ] 2.2 Git: on verbose, include `git --version` stdout (or clear miss reason); honor existing git mock hooks
- [ ] 2.3 Manifest: on verbose when present, include path + name/version identity; absent stays non-critical ok
- [ ] 2.4 Lockfile: on verbose when present, include path + `lockfile_version` and/or dependency count; absent stays non-critical ok
- [ ] 2.5 Modules: on verbose, include path + exists/entry-count or explicit absent; keep not-a-directory critical FAIL

## 3. SHOULD thin probes (S1–S2)

- [ ] 3.1 Add informational or verbose-only `network` probe via `git ls-remote` with ≤5s timeout; never critical; skip when not verbose if choosing verbose-only
- [ ] 3.2 Add informational `auth`/`auth-env` row for `GITHUB_TOKEN`/`GH_TOKEN` presence by name only; never print secrets; never critical
- [ ] 3.3 Ensure help mentions network/auth only when shipped (no help lies)

## 4. Guardrails and verification (G5)

- [ ] 4.1 Assert no marketplace / format / duplicate / version-alignment / executable-trust doctor rows
- [ ] 4.2 Acceptance coverage: default doctor green; `-v`/`--verbose` accepted + richer domain detail; unknown flag fail-closed; no harness deploy from doctor
- [ ] 4.3 Extend core doctor tests (§22–23 path) and CLI doctor tests for verbose + unknown-flag regressions
- [ ] 4.4 Run targeted `vp`/vitest for core Doctor + CLI doctor suites; fix regressions; no CONFORMANCE edits
