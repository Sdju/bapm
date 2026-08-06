## 1. User store and layered resolver (G1, G4)

- [x] 1.1 Add load/save helpers for `~/.bapm/config.json` → `executables.{allow,deny}` with injectable config root (owner-only perms preferred)
- [x] 1.2 Implement pure `resolveExecutableTrust` (org + project + user deny-wins ladder; MCP type; preserve absent-surface skip)
- [x] 1.3 Export resolve/classify aliases from `ExecutableTrust` public API; keep project-only evaluate path as thin wrapper or migrate callers
- [x] 1.4 Unit tests: user store round-trip under temp config root; resolver org-deny shadows project/user allow; withhold when surface present

## 2. Policy executables parse and merge (G3)

- [x] 2.1 Parse typed top-level `executables.deny_all` / `executables.deny` in Policy; add to known top-level set; ignore recommend/enforce/require for claim
- [x] 2.2 Merge across extends: `deny_all` OR, `deny` ∪ (dedupe, parent order)
- [x] 2.3 Unit tests: parse + merge fixtures; pl-009 still warns on other unknown top-level keys

## 3. Install gate + audit twin + require presence (G4–G8)

- [x] 3.1 Wire install MCP deploy gate to load project + user + effective org executables and call `resolveExecutableTrust` (do not weaken sc-009 fail-closed)
- [x] 3.2 Expose audit/trust classifier using the **same** resolve function; thin audit path or Mode B dual-call with identical inputs
- [x] 3.3 Implement lockfile-presence check for `dependencies.require` + distinct withheld diagnostic code ≠ `POLICY_REQUIRE`
- [x] 3.4 Unit/integration tests: install≡audit twin; org deny fixture; present+withheld vs missing-from-lock

## 4. CLI approve/deny FEOD (G2)

- [x] 4.1 Add FEOD directory modules `Approve` and `Deny` with `index.ts` public API; thin `commands/approve` + `commands/deny`; register in app; wire core via integrations
- [x] 4.2 Interactive path defaults to user store only; assert MUST NOT write project `bapm.yml`; update help text
- [x] 4.3 CLI tests with isolated HOME/config root for approve/deny persistence and yml untouched

## 5. Acceptance, Mode B claims, docs (G9–G10)

- [x] 5.1 Acceptance suite under `**/sc-executable-governance/` covering G1–G10 (user store, no yml write, org deny-wins, install≡audit, require+withheld, checklist expectations)
- [x] 5.2 Flip checklist `req-sc-010`/`011`/`012` → `active` with citations only; keep skipped 003/004/005/008/013; no citation churn on 001/002/006/007/009
- [x] 5.3 Update Limitations/scope_out: remove approve absolute OOS for claimed surface; keep host-class + soft zip; MCP-only soft honesty for hooks/bin/canvas
- [x] 5.4 Run `conformance:gen` + `conformance:check`; align docs-openapm-boundary residual wording
