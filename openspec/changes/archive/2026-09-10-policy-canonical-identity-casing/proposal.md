## Why

OpenAPM v0.1 (APM Unreleased / #2706) adds **req-pl-018** so dependency-policy `allow` / `deny` / exact `require` matching uses the same per-host repository case rule as **req-rs-016** clause (3). bapm still matches policy patterns byte-exactly, so mixed-case GitHub/registry identities can miss lowercase deny patterns (**deny fail-open**) and block legitimate mixed-case allows. CONFORMANCE / checklist currently stop at **req-pl-016**. This is the **last** APM 0.28–0.30 parity roadmap slice for bapm.

## What Changes

- Implement **req-pl-018**: at match time, ASCII-normalize repository-coordinate segments for hosts/sources disclosed as case-insensitive (`github.com`, `*.ghe.com`, `GITHUB_HOST` GHES, registry-sourced deps); keep virtual paths, `#` refs, MCP names, unmanaged paths, and case-sensitive hosts byte-exact.
- Fix mixed-case **allow** / **deny** / exact **require** evaluation; **deny still wins** after normalization; lowercase patterns keep matching; Section 6.4 merge remains byte-exact on authored entries.
- Align resolve/lock **package identity** path casing with the same disclosed rule so identity and policy matching do not diverge (req-rs-016 amendment).
- Claim **req-pl-018** in Mode B checklist + informative requirements mirror; regenerate CONFORMANCE with an explicit **Repository case rules** disclosure (OpenAPM §11.2 item 6). Mark **req-pl-017** (ADO org-policy discovery) **n/a** (ADO cascades already scope-out).
- Unit/acceptance coverage for mixed-case allow/deny/require, virtual-path sensitivity, registry vs non-GitHub host, and fail-closed deny.

### Non-goals (this change)

- gh-aw / apm-action / `token-source` (APM distribution surface).
- Homebrew / Unix `install.sh`, Hermes, grok-cloud.
- trust-bin, exclusive plugin `skills:`, Copilot native Agent Plugins, `pack --check-versions` (already shipped).
- Full ADO / multi-candidate policy cascades; changing MCP name matching or unmanaged-file path case rules.
- Unicode case folding / locale-sensitive mapping (out of OpenAPM v0.1).

### Follow-ups (not tasks of this change)

- **DEFER only (note):** Hermes runtime, grok-cloud, Homebrew/`install.sh` — outside this APM 0.28–0.30 parity roadmap. No further OpenAPM Unreleased policy/identity slices remain after this change.

## Capabilities

### New Capabilities

- _(none)_ — behavior lands in existing governance/consumer capabilities.

### Modified Capabilities

- `policy-rule-evaluate`: Match `dependencies.allow` / `deny` / exact `require` under req-pl-018 identity casing (ASCII, bounded repo-coordinate prefix, deny-wins, merge unchanged).
- `dependency-resolve`: Apply the same disclosed per-host / registry path case rule at identity boundaries so resolve/cache identity cannot diverge from policy matching (req-rs-016 clause 3).

## Impact

- `@b-apm/core`: Policy matcher (`match.ts` / evaluate); shared or mirrored identity normalization (Resolver / Lockfile); optional evaluate options for host/source context.
- Conformance: `tests/spec-conformance/checklist.yml`, `openapm-v0.1.requirements.yml`, `scripts/gen-conformance-statement.mjs` (case-rules section), regenerated `CONFORMANCE.md` / `.json`.
- Docs: brief governance / policy note if user guide cites allow/deny matching.
- Tests: core policy evaluate/match unit tests + acceptance suite in later orch phases; no new workspace packages; no lockfile format bump.
