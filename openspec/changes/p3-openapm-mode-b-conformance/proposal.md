## Why

After M1–M10 plus P1 (lk-015) and P2 (lk-018), bapm implements an OpenAPM v0.1 Consumer/Producer/Governance **floor**, but still has no published **conformance statement** and no Mode B (fixture-anchored §12) evidence for **req-cf-001** / **req-cf-002**. Without a verifiable claim, interop and parity docs cannot honestly advertise conformance against OpenAPM where bapm actually implements it.

## What Changes

- Add a **Mode B** conformance harness: vendor (or sync) OpenAPM v0.1 seed fixtures from APM `tests/fixtures/spec-conformance/`, plus a TypeScript/Vitest suite (or req-ID checklist bound to existing package tests) that exercises declared requirements against those fixtures.
- Satisfy **req-cf-001**: idempotent manifest/lockfile round-trip (parse → serialize → parse → serialize) with unknown/`x-*` preservation where bapm claims Consumer.
- Satisfy **req-cf-002**: publish root **`CONFORMANCE.md`** (and machine-readable **`CONFORMANCE.json`** if practical) that lists claimed classes, spec version `v0.1`, optional features, limitations/waivers, and per-`req-XXX` fixture path + assertion citation for every requirement in scope.
- Claim posture (honest floor, not APM-full):
  - **Consumer** — primary claim (with explicit waivers/N/A for non-goals such as multi-host `tg-*` beyond cursor where OpenAPM enumerates host matrix broadly).
  - **Producer** — claim after init/pack/pr-004 coverage is cited.
  - **Governance** — **floor** claim: local dual-read + gate; remote/`extends` and unimplemented `pl-*` documented as skipped/N/A (no P4 implementation).
  - **Registry** class — **N/A** (no host / no rg-001 claim); Consumer digest verify remains cited under Consumer `lk-013`/`rs-009` only.
- Wire a CI-friendly check that the committed statement matches the suite/checklist coverage (drift fails the job), analogous in spirit to APM’s `gen_statement` + `git diff` gate—without requiring the Python suite.
- **Non-goals:** multi-target adapters; marketplace/plugin; registry **host**/rg-001 claim; implementing P4 remote policy/`extends`; inventing unsupported features as `active`/`pass`; rewriting product behavior beyond fixes strictly required for honest fixture round-trips already implied by existing specs.

## Capabilities

### New Capabilities

- `openapm-conformance-statement`: Mode B fixtures + Vitest/checklist harness, cf-001 round-trip, published Consumer/Producer/(Governance floor) CONFORMANCE artifacts and CI drift gate; Registry class explicitly N/A.

### Modified Capabilities

- _(none)_ — product runtime requirements stay as archived M1–M10/P1/P2; this change adds claim evidence and statement artifacts. Any behavioral fix discovered while running fixtures is a follow-on or a minimal bugfix only if required for an already-claimed MUST.

## Impact

- New in-repo fixtures under a stable path (e.g. `tests/fixtures/spec-conformance/`) vendored from OpenAPM seed (`.samples/apm` is gitignored and cannot be the sole source of truth).
- New Vitest modules (likely under `packages/core/tests/spec-conformance/` and/or repo `tests/spec-conformance/`) mapping `req-*` → fixtures/assertions; optional small generator script for CONFORMANCE.md/json.
- Repo-root `CONFORMANCE.md` (+ `CONFORMANCE.json`); optional CI workflow or `vp` task to regenerate/diff.
- Docs/knowledge posture updated only as needed to point at the published statement (P5 broad docs remain out of scope).
- Follow-on out of scope: P4 Governance remote/extends; multi-target; marketplace; formal Registry host.
