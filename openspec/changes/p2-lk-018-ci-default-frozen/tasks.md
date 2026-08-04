## 1. Core frozen resolution helper

- [ ] 1.1 Add `isCiEnvTruthy` / `resolveEffectiveFrozen` (OpenAPM CI truthiness + flag precedence) under `@bapm/core` Install; export from Install public API
- [ ] 1.2 Unit-test truthy/non-truthy `CI` values and precedence (`--frozen` / `--no-frozen` / conflict / default)

## 2. CLI wiring

- [ ] 2.1 Parse `--no-frozen` in install args; reject `--frozen` + `--no-frozen`; resolve effective frozen via core helper using `process.env` (injectable for tests)
- [ ] 2.2 Pass resolved `frozen` into `runInstall`; ensure CI-default + `--update` rejects before mutation
- [ ] 2.3 Update install help + shared Help formatter: document `--no-frozen` and CI-default frozen

## 3. Tests and docs notes

- [ ] 3.1 CLI/unit tests: `CI=true` install without lock fails frozen; `--no-frozen` under CI allows lock write; non-CI default unchanged; flag conflict
- [ ] 3.2 Brief Install README note: lk-018 CI-default + programmatic helper; do not reopen P1
- [ ] 3.3 Run affected CLI/core install test suites
