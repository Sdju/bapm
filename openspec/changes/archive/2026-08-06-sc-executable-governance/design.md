## Context

See proposal.md — Why. Today `ExecutableTrust.evaluateExecutableTrust` is project-grant-only (sc-009 active). Org policy parse knows `dependencies.*` but not typed `executables.deny`/`deny_all`. No `~/.bapm/config.json` executables store; no Approve/Deny CLI modules. Audit CI covers lock/hashes/`tree_sha256` only — no trust twin, no lockfile-presence require vs withheld split. Criteria: `.samples/apm-knowledge/topics/sc-executable-governance-criteria.md` (G1–G10, D1–D10 locked).

## Goals / Non-Goals

**Goals:**
- Close G1–G10 in one L change; claim sc-010/011/012 only.
- One pure `resolveExecutableTrust` shared by install MCP gate and audit/trust classifier.
- Interactive grants → user `config.json` only; org deny floor only (no recommend/enforce).

**Non-Goals (design-level):**
- Glob deny matching (exact id OK; glob SHOULD later).
- `policy explain`, `approve --list`/`--pending`, `approve --project`.
- Extending gate to hooks/bin/canvas.
- Changing sc-009 fail-closed semantics when surface present.

## Decisions

### D1: User store path + API (G1)
- **Choice:** `<configRoot>/config.json` with `{ executables: { allow, deny } }`; reuse `getBapmConfigDir`-style injectable root (Marketplace paths pattern or ExecutableTrust-owned helper next to it). Prefer `0o600` on write (SHOULD S3).
- **Why:** Locked D2; APM `~/.apm/config.json` parity under bapm branding.
- **Alternatives:** Separate `executables.json` — rejected (criteria locks `config.json`).

### D2: Interactive CLI = user-only (G2)
- **Choice:** New FEOD modules `Approve` + `Deny` (directory + `index.ts`), thin `commands/approve.ts` / `commands/deny.ts`, register in app. Default (or require `--user`) writes user store only; refuse project yml writes on interactive path.
- **Why:** Locked D3; sc-010 MUST NOT write interactive → project manifest.
- **Alternatives:** APM-style project-default + `--user` — rejected for thin claim.

### D3: Policy executables parse + merge (G3)
- **Choice:** Add `executables` to known top-level; typed `{ deny_all?: boolean; deny?: string[] }`. Merge in `mergeDocuments`: `deny_all` OR, `deny` ∪ (dedupe, parent order). Ignore recommend/enforce/require for claim; do not fail parse on extras.
- **Why:** Locked D5; pl-009 retained for other unknowns.
- **Alternatives:** Keep executables as opaque unknown — rejected (need typed deny-wins).

### D4: Shared `resolveExecutableTrust` (G4/G5/G6)
- **Choice:** New pure function in `ExecutableTrust` accepting `{ orgExecutables, projectSurface, userSurface, packageName, executableType }`. Keep `evaluateExecutableTrust` as thin wrapper over project-only inputs OR deprecate internally by routing all callers through resolve. Ladder: org deny_all / org deny → project|user deny → project allow → user allow → withhold if any grant surface present else skip (preserve sc-009 absent-surface skip). Exact package id match for org deny list (glob SHOULD later).
- **Why:** Locked D7; install≡audit.
- **Alternatives:** Duplicate ladder in Audit — rejected (sc-011 twin evidence).

### D5: Audit twin surface (G5/G8)
- **Choice:** Smallest truthful path: core API `classifyExecutableTrust` (alias of resolve) + thin audit check (or Mode B dual-call of the same fn with identical fixtures). Prefer extending `runAuditCi` with an optional trust/require section **or** a dedicated exported classifier used by both audit CLI and Mode B — pick whichever lands fewer LOC while proving twin outcomes. CI hash/`tree_sha256` checks unchanged.
- **Why:** Locked D8; prove install≡audit without full APM policy_checks matrix.
- **Alternatives:** Mode-B-only dual-call without audit CLI — acceptable if classifier is public core API and Mode B cites it; prefer wiring a thin audit path when cheap.

### D6: Require presence from lock + withheld code (G7/G8)
- **Choice:** New evaluator (Policy or Audit helper) `evaluateRequiredPackagePresence({ require, lockPackageIds, trustByPackage })`. Presence = id in lock set. If present and MCP trust outcome is withhold/deny → emit stable code e.g. `EXEC_TRUST_WITHHELD` (name flexible, MUST ≠ `POLICY_REQUIRE`). Missing from lock → `POLICY_REQUIRE` (or existing missing-package code).
- **Why:** sc-012; install candidate require can stay as-is for install gate.
- **Alternatives:** Overload `evaluateInstallPolicy` with lock mode — risk conflating install vs audit; prefer explicit lock-presence API.

### D7: Wire install MCP gate (G4)
- **Choice:** Install path loads project grants + user store + effective org policy executables, then calls `resolveExecutableTrust` before MCP write (same withhold diagnostics as today for unapproved).
- **Why:** Must not weaken sc-009; adds layers.
- **Alternatives:** Project-only continue — rejected (blocks sc-011).

### D8: Claim flip + honesty (G9/G10)
- **Choice:** After GREEN coverage under `**/sc-executable-governance/`, edit `checklist.yml`: 010/011/012 → active with citations; leave 003/004/005/008/013 skipped; leave 001/002/006/007/009 active. Remove approve/deny absolute OOS from limitations/scope_out; keep host-class + soft zip; note MCP-only soft for hooks/bin/canvas. `conformance:gen` + `conformance:check`. Align docs boundary page.
- **Why:** Implement-then-claim; locked D1/D9/D10.
- **Alternatives:** Flip before code — forbidden.

### D9: Size L truthful thin
- **Choice:** No recommend/enforce/bin_deploy; MCP-only; exact deny match; optional SHOULD items out.
- **Why:** Criteria size L; XL only if product expands.

## Gaps → design map

| Gap | Decision / landing |
|-----|-------------------|
| G1 User store | D1 |
| G2 approve/deny CLI user-only | D2 |
| G3 Policy executables parse | D3 |
| G4 Layered resolve + install | D4, D7 |
| G5 Audit twin same resolver | D5 |
| G6 Org deny shadows allow | D4 + Mode B fixture |
| G7 Require from lockfile | D6 |
| G8 Distinct withheld diagnostic | D6 |
| G9 Mode B + gen/check | D8 |
| G10 Limitations honesty | D8 |

## Risks / Trade-offs

- **[Risk] Grant-surface “present” semantics with user-only grants** → Mitigation: treat user store with allow/deny keys as a grant surface for fail-closed; document that empty user file without executables key is absent.
- **[Risk] Install require vs audit require divergence** → Mitigation: keep install candidate require unchanged; document sc-012 as lock-presence fidelity on audit/classifier path.
- **[Risk] FEOD drift (logic in commands/)** → Mitigation: core owns store+resolve; CLI modules thin adapters via integrations.
- **[Risk] Accidental checklist churn on 001/002/006/007/009** → Mitigation: tasks explicitly forbid citation edits on those rows.
- **[Risk] Claiming sc-011 without twin evidence** → Mitigation: acceptance fixture calls install path and classifier with same bags.

## Migration Plan

1. Core: user store + resolveExecutableTrust + policy parse/merge + presence/withheld helper.
2. Wire install MCP gate; thin audit/classifier.
3. CLI Approve/Deny FEOD + help/registry.
4. Acceptance GREEN → checklist flip + Limitations + gen/check + docs.
5. No VCS migration; user `config.json` created on first approve/deny.

## Open Questions

_None blocking — audit CLI vs core-only classifier resolved as D5 (prefer thin audit if cheap; Mode B dual-call of public resolve is minimum bar)._
