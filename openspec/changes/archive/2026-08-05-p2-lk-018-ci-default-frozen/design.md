## Context

See proposal.md — Why. Today `bapm install` is non-frozen unless `--frozen` is passed (`packages/cli/.../parseInstallArgs`, `options.frozen === true` in `@b-apm/core` `runInstall`). OpenAPM §5.5 **req-lk-018** (SHOULD) defaults to frozen when `CI` is truthy, with explicit non-frozen override. Reference APM CLI documents `apm install --frozen` as the CI pattern but does **not** auto-apply lk-018 from `CI` alone — bapm intentionally implements the OpenAPM SHOULD (stricter/safer than current APM UX). P1 lk-015 is archived and must not be reopened.

## Goals / Non-Goals

**Goals:**

- Shared OpenAPM-accurate `CI` truthiness helper + effective-frozen resolution
- CLI: `--no-frozen` opt-out; CI-default on; keep `--frozen`; reject conflicts
- Spec lift: remove “lk-018 optional/deferred” from install-pipeline

**Non-Goals:**

- Extra vendor env heuristics (`GITHUB_ACTIONS`, `GITLAB_CI`, …) beyond reading `CI` (those platforms already set `CI=true`)
- Auto-frozen for `update`/`lock`/`audit` commands
- Mode B / CONFORMANCE / Governance / multi-target / P5 docs beyond install help

## Decisions

1. **Truthiness:** Follow OpenAPM literally — `CI` present and not `""` / `"0"` / `"false"` (case-insensitive). Alternative: treat any non-empty `CI` as truthy — rejected (would freeze on `CI=false`).
2. **Opt-out flag:** `--no-frozen` as the explicit non-frozen invocation. Alternative: treat bare `--update` as implicit opt-out — rejected (OpenAPM wants explicit non-frozen; silent unlock under CI is unsafe).
3. **Flag precedence:** `--frozen` and `--no-frozen` together → hard error. Else `--no-frozen` → effective frozen false (even if `CI` truthy). Else `--frozen` OR truthy `CI` → effective frozen true. Else false.
4. **Where to resolve:** Export a small pure helper from `@b-apm/core` Install (e.g. `isCiEnvTruthy(env)` + `resolveEffectiveFrozen({ frozen?, noFrozen?, env })`). CLI parses flags and passes resolved `frozen: boolean` into `runInstall`. Library callers that omit flags but run under `CI` SHOULD get the same default when using the helper (document in Install README); raw `runInstall({ frozen: false })` remains an explicit opt-out for tests/tools.
5. **Env source:** Prefer `process.env` at CLI boundary; helper accepts `Record<string, string | undefined>` for tests. Do not read other CI vendor vars.
6. **APM divergence (intentional):** APM still requires `--frozen` in CI docs; bapm implements OpenAPM SHOULD. Note only in design/help — not a product bug vs APM.

## Risks / Trade-offs

- [CI jobs that ran bare `bapm install` to regenerate locks] → Mitigation: document `--no-frozen`; fail closed is the intended SHOULD.
- [Tests inheriting host `CI=true`] → Mitigation: acceptance/unit tests MUST control `CI` (unset / inject); isolate `env` in helper unit tests.
- [Confusion with `audit --ci`] → Mitigation: help text distinguishes env `CI` default-frozen install from `audit --ci` gate; no behavior change to audit.
- [Library vs CLI skew] → Mitigation: single helper; CLI always uses it; README notes programmatic callers.

## Migration Plan

1. Land helper + unit tests for truthiness / precedence.
2. Wire CLI parse/help; reject `--frozen`+`--no-frozen` and CI-default+`--update`.
3. Acceptance: CI without lock fails; `--no-frozen` under CI writes lock; non-CI unchanged.
4. No lockfile format migration; no archive of P1.

## Open Questions

None blocking — opt-out flag name `--no-frozen` and OpenAPM-only `CI` detection are fixed above.
