## 1. Core frozen resolution helper

- [x] 1.1 Add `isCiEnvTruthy` / `resolveEffectiveFrozen` (OpenAPM CI truthiness + flag precedence) under `@bapm/core` Install; export from Install public API
- [x] 1.2 Unit-test truthy/non-truthy `CI` values and precedence (`--frozen` / `--no-frozen` / conflict / default)

## 2. CLI wiring

- [x] 2.1 Parse `--no-frozen` in install args; reject `--frozen` + `--no-frozen`; resolve effective frozen via core helper using `process.env` (injectable for tests)
- [x] 2.2 Pass resolved `frozen` into `runInstall`; ensure CI-default + `--update` rejects before mutation
- [x] 2.3 Update install help + shared Help formatter: document `--no-frozen` and CI-default frozen

## 3. Tests and docs notes

- [x] 3.1 CLI/unit tests: `CI=true` install without lock fails frozen; `--no-frozen` under CI allows lock write; non-CI default unchanged; flag conflict
- [x] 3.2 Brief Install README note: lk-018 CI-default + programmatic helper; do not reopen P1
- [x] 3.3 Run affected CLI/core install test suites
