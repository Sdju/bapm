## 1. Core status helper

- [x] 1.1 Add `runPolicyStatus` + `PolicyStatusReport` types in Policy module (reuse discover/load/resolve; no second resolver)
- [x] 1.2 Map outcomes `found` / `absent` / `disabled` / `error`; redact sources/extends; compute `rule_counts` + `extends_chain` + warnings/diagnostics
- [x] 1.3 Handle escape (`noPolicy` / `BAPM_POLICY_DISABLE` / `APM_POLICY_DISABLE`), explicit path, dual-file conflict, soft fetch/schema failures
- [x] 1.4 Export from Policy index and package publicApi
- [x] 1.5 Unit tests: found (apm-policy.yml and bapm-policy.yml), absent, escaped, explicit path, dual conflict, fetch/schema error, redaction, extends_chain, rule_counts, ASCII-safe/deterministic

## 2. CLI policy status

- [x] 2.1 Add FEOD `modules/Policy` (parse args, format human/JSON, run via core helper)
- [x] 2.2 Add `commands/policy.ts` + `app/init/policy.ts`; register `policy`/`status` only in constants/registry
- [x] 2.3 Wire `--json`, `--policy`, `--no-policy`, `--check`; omit `--no-cache`; update top-level and status help
- [x] 2.4 CLI tests: help mentions policy; found; absent exit 0; escaped flag/env; explicit path; dual conflict exit 0; check non-zero when unusable; JSON stable keys; redaction; no lock/modules mutation

## 3. Docs / closeout

- [x] 3.1 Sync knowledge/roadmap note that P6d implemented (no CONFORMANCE claim edits)
- [x] 3.2 Run focused core/cli tests; mark tasks complete
