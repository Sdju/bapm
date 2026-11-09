## 1. Tests

- [x] 1.1 Core: empty `skills:` subset still diagnoses `EMPTY_SKILL_SUBSET` with `warn: true` and requested/available names
- [x] 1.2 Core: partial subset (`keep-me` + `gone`) deploys the match, diagnoses `SKILL_SUBSET_UNMATCHED` for the leftover name
- [x] 1.3 Core: exact subset does not emit empty/unmatched subset diagnostics
- [x] 1.4 CLI: path dep `skills: [gamma]` with only `alpha`/`beta` available prints `bapm: warning:` and `EMPTY_SKILL_SUBSET`, exit 0, deploys no skills
- [x] 1.5 CLI: path dep `skills: [alpha, ghost]` prints `bapm: warning:` naming `ghost`, deploys `alpha`

## 2. Implementation

- [x] 2.1 `applySkillSubsets`: diagnose unmatched requested names; `warn: true`; keep `EMPTY_SKILL_SUBSET` for zero matches
- [x] 2.2 CLI `isWarningDiagnostic`: treat `SKILL_SUBSET` codes as warnings

## 3. Docs and verify

- [x] 3.1 User docs: unknown `skills:` names warn; install still succeeds
- [x] 3.2 CHANGELOG Unreleased note
- [x] 3.3 `vp test` for the new core and CLI files; related subset tests stay green
