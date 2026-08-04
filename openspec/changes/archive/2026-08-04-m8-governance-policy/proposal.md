## Why

M1–M7 delivered Consumer + Producer floor without OpenAPM **Governance** (§6 `pl-*`): no policy parse, dual-file discovery, or install abort before durable writes. M8 adds an install-centric policy gate in `@bapm/core` + CLI so org allow/deny/require rules can block or warn before modules materialization and target deploy—without new hosts or exec approve/deny UX.

## What Changes

- **`@bapm/core`:** new Policy module — parse/validate `*-policy.yml` (enforcement `off|warn|block`, fetch_failure defaults, dependencies allow/deny/require/max_depth/require_pinned_constraint, pl-005 tri-state, pl-009 unknown TL warn / `x-*` preserve); local dual-read discovery; evaluate install candidates; gate API returning block/warn/off results
- **Install pipeline:** resolve **plan** → **policy gate** → download / modules / deploy (OpenAPM-strict pl-002 preferred over APM’s resolve-time download); absent policy or escape → ungated
- **`bapm` CLI (FEOD):** `--policy` / `--no-policy` (and `BAPM_POLICY_DISABLE=1`, mirror APM) on install; help documents flags; thin optional `policy status` if cheap for diagnostics
- **Dual-read:** `apm-policy.yml` | `bapm-policy.yml` at project root only (no parent walk); both → hard error; explicit `--policy` wins; scaffold default `bapm-policy.yml` if template ships
- **Defaults for gaps:** discovery **local-only** (`github-owner-dotgithub` deferred); gate **`lock`** SHOULD if cheap (document); `update` same gate when it shares install path; `extends` / remote fetch / pl-010–012 deferred or N/A until providers exist; `approve`/`deny` exec → **M9**
- **HARD:** packages `@bapm/core` + CLI only; **MUST NOT** add new `bapm-target-*`
- **Non-goals:** compile/MCP marketplace (M9); registry publish (M10); full Governance class claim unless documented subset green; remote dual-read of `bapm-policy.yml`

## Capabilities

### New Capabilities

- `policy-yaml-parse`: Parse/validate policy mapping root; coerce enforcement enums (YAML `off` bool → `"off"`); tri-state allow/deny/require; unknown TL keys warn; `x-*` silent preserve; reject invalid enforcement
- `policy-dual-file-discovery`: Local dual-read `apm-policy.yml` | `bapm-policy.yml`; both → conflict error; neither → absent; explicit path wins; no parent walk; ordered providers list starts with local-only
- `policy-rule-evaluate`: Evaluate allow/deny (deny wins), require, max_depth, require_pinned_constraint (pl-007/008) against install candidate set; map to off/warn/block outcomes
- `policy-install-gate`: Gate install (MUST) before modules+deploy writes; escape `--no-policy` / env; SHOULD gate lock/update when cheap; document deferred remote/extends

### Modified Capabilities

- `install-pipeline`: Insert policy gate after resolve plan / before download+materialize+deploy; honor noPolicy / absent policy; fail closed on block+violation (pl-002)
- `lock-command`: SHOULD run same policy gate before lock write / modules side effects when cheap; document if deferred
- `lifecycle-update`: Apply same install gate when update shares install orchestration
- `cli-runtime-surface`: Wire `--policy` / `--no-policy` on install (and lock/update if gated); help lists flags; optional thin `policy status`
- `cli-feod-architecture`: Thin handlers + FEOD module(s) for Policy; no business logic in `commands/` / `app/`
- `core-feod-architecture`: New library `Policy` module (directory + `index.ts`); export via `app/publicApi`; no single-file module; no core→cursor hard dep
- `target-package-architecture`: Reaffirm M8 allow-list — only existing `bapm-target-api` + `bapm-target-cursor`; forbid new hosts

## Impact

- **`@bapm/core`:** public Policy parse/discover/evaluate/gate APIs; Install (and Lock/Update as applicable) call gate before durable writes; may split resolve plan from download for pl-002
- **`bapm` CLI:** install flag parsing + escape env; optional `policy` command; FEOD `modules/Policy` or compose via Install soft IoC
- **Governance claim:** optional subset after M8 if conformance lists local-only providers and deferred `pl-*` as N/A/waived
- **Out of scope this phase:** production/acceptance code authored here; git commit
