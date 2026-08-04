## 1. Core Policy module — parse + model

- [x] 1.1 Create `packages/core/src/modules/Policy/` (directory + `index.ts` + README); types/errors for policy document and diagnostics
- [x] 1.2 Implement `parsePolicy` / `loadPolicy`: mapping-root only; coerce `enforcement: off` YAML bool → `"off"`; default enforcement/`fetch_failure` per OpenAPM (`warn`)
- [x] 1.3 Validate enums; reject invalid enforcement; pl-009 unknown TL keys → warnings; `x-*` silent preserve; pl-005 tri-state for allow/deny/require
- [x] 1.4 Accept `dependencies` fields needed for M8 (`allow`/`deny`/`require`/`max_depth`/`require_pinned_constraint`); export from `app/publicApi` / package entry

## 2. Core Policy — dual-file discovery

- [x] 2.1 Add `APM_POLICY_FILE` / `BAPM_POLICY_FILE` and `discoverPolicyPath` (or equivalent): only-apm / only-bapm / both-conflict / neither-absent; explicit path wins; no parent walk
- [x] 2.2 Model ordered discovery providers as local-only list; document remote/`github-owner-dotgithub` as deferred N/A
- [x] 2.3 Wire load path: discover → parse; missing explicit file fails closed

## 3. Core Policy — evaluate + gate API

- [x] 3.1 Implement rule evaluation: deny wins over allow; require missing; max_depth; require_pinned_constraint (pl-007/008 pin forms)
- [x] 3.2 Map enforcement `off|warn|block` to gate result (blocking vs warnings vs skip)
- [x] 3.3 Implement escape detection (`noPolicy` option + `BAPM_POLICY_DISABLE` / `APM_POLICY_DISABLE`); absent policy → ungated
- [x] 3.4 Export evaluate/gate helpers on Policy public API

## 4. Install pipeline — plan → gate → download

- [x] 4.1 Split resolve **plan** from download on gated install paths (`resolveDependencyGraph` then gate then `downloadPackages`); avoid durable modules/deploy before block abort
- [x] 4.2 Call policy gate from `runInstall` / `installProject` after plan, before download + primitives + target materialize; honor `--policy` path / noPolicy
- [x] 4.3 Dual-conflict at root fails install before resolve/deploy mutation; warn mode emits diagnostics and continues
- [x] 4.4 Extend Install options/types for policy path and noPolicy; document in Install README

## 5. Lock + Update gate wiring

- [x] 5.1 Wire same policy gate into lock path before download + lock write (SHOULD; include by default per design D5)
- [x] 5.2 Wire same gate into mutating `update` path; dry-run remains non-mutating
- [x] 5.3 If any gate path is deferred, document explicitly in module README / conformance note

## 6. CLI FEOD surface

- [x] 6.1 Parse `--policy` / `--no-policy` on `install` (and lock/update when gated); pass through integrations; honor env disable
- [x] 6.2 Update install (and lock) help to document policy flags; unknown flags still hard-error
- [x] 6.3 Optional: thin `policy status` command + FEOD module if cheap; else skip and note diagnostics-via-install
- [x] 6.4 Ensure commands stay thin; core only via `app/integrations` / `app/init`; no single-file modules

## 7. Package graph + verification (apply only)

- [x] 7.1 Confirm workspace still has only `bapm-target-api` + `bapm-target-cursor` among `bapm-target-*`; no new target package; no core→cursor hard dep
- [x] 7.2 Keep M3–M7 regressions green without policy files (install/lock/update/audit/pack)
- [x] 7.3 Run build/test/`vp check` for `@bapm/core` and `bapm`; fix in-scope regressions
- [x] 7.4 Spot-check: block deny aborts before modules; warn allows; `--no-policy` escapes; dual-conflict errors; explicit `--policy` wins
