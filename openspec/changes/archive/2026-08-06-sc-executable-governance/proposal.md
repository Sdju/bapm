## Why

Mode B still skips OpenAPM consumer MUSTs `req-sc-010` / `req-sc-011` / `req-sc-012` (§10.13–10.14) after soft-security claims: no interactive user-local approve, no org `executables.deny`/`deny_all` deny-wins ladder shared with audit, and no lockfile-presence + distinct-withheld fidelity for `dependencies.require`. Queue #3 is to implement-then-claim all three in one truthful L slice on the existing sc-009 MCP trust surface.

## What Changes

- User-local interactive `bapm approve` / `bapm deny` persisting grants under `~/.bapm/config.json` → `executables: { allow, deny }` (injectable config root for tests); interactive path MUST NOT write into project `bapm.yml` / `apm.yml`.
- Typed org policy parse+merge for `executables.deny_all` (OR across extends) and `executables.deny` (∪); ignore `recommend` / `enforce` / `executables.require` for this claim.
- Single pure `resolveExecutableTrust` (extend/replace project-only `evaluateExecutableTrust`) with deny-wins precedence: **org deny > project/user deny > project allow > user allow > (gate on → withhold)**; MCP-only for gate+audit twin.
- Install MCP deploy gate and audit/trust classifier call the **same** resolver for identical inputs → identical allow/deny/withhold outcome.
- `dependencies.require` presence for governance/audit fidelity = package **in resolved lockfile**; present+MCP-withheld → presence OK + diagnostic distinct from `POLICY_REQUIRE` / missing-package.
- Mode B: flip only `req-sc-010` / `011` / `012` to `active` with citations under `**/sc-executable-governance/`; keep skipped `003`/`004`/`005`/`008`/`013`; no churn on active `001`/`002`/`006`/`007`/`009`; Limitations remove “approve OOS” for claimed surface; host-class still deferred; `conformance:gen` + `conformance:check` green.
- Acceptance under `**/sc-executable-governance/` covering G1–G10.

**Non-goals:** `recommend` / `enforce` / `bin_deploy` / org `executables.require`; gating hooks/bin/canvas; full APM `approve --all`/`--recommended`/`--pending`; project-default interactive write to yml; `policy explain` (SHOULD); host-class sc-003/005/008/013; sc-004 soft zip; re-claim or churn sc-009.

## Capabilities

### New Capabilities

- `executable-user-grants`: Load/save user-local executable grants in `~/.bapm/config.json` and expose interactive `bapm approve` / `bapm deny` that persist only to that store (sc-010).

### Modified Capabilities

- `executable-mcp-trust`: Layered deny-wins `resolveExecutableTrust` (org + project + user); install MCP gate consumes it; document soft (ungated) hooks/bin/canvas; keep sc-009 fail-closed when grant surface present.
- `policy-yaml-parse`: Parse typed top-level `executables.deny_all` / `executables.deny`; retain pl-009 for other unknown top-level keys; do not require recommend/enforce for claim.
- `policy-extends-resolve`: Merge `executables.deny_all` as logical OR and `executables.deny` as union across extends.
- `audit-integrity`: Trust classification path sharing the resolver with install; `dependencies.require` presence from lockfile entries; distinct withheld diagnostic when required package is present but MCP withheld.
- `cli-runtime-surface`: Register top-level `approve` / `deny` (user-scope interactive defaults); help/registry mention.
- `cli-feod-architecture`: FEOD `Approve` / `Deny` directory modules + thin `commands/` handlers; core via `app/integrations`.
- `openapm-conformance-statement`: Activate `req-sc-010`/`011`/`012` with Mode B citations; keep host-class/soft skips; preserve actives 001/002/006/007/009; refresh Limitations/scope_out honesty.
- `docs-openapm-boundary`: Align guide/Limitations residual text — interactive user-local approve claimed; host-class / soft container still deferred.

## Impact

- `@b-apm/core`: `ExecutableTrust` (resolver + user store helpers), `Policy` parse/merge types for `executables`, Audit (or twin classifier API) for require↔lock↔withheld + shared resolve.
- `bapm` CLI: new Approve/Deny modules (FEOD), app registry/help, install path wires layered grants (project + user + org).
- Mode B: `tests/spec-conformance/checklist.yml` → `conformance:gen` / `conformance:check`; Limitations / scope_out.
- Docs: conformance boundary residual security wording.
- Tests: acceptance under `**/sc-executable-governance/`; unit coverage for resolver/deny-wins/user store.
- Does **not** require recommend/enforce/bin_deploy; does **not** gate hooks/bin/canvas; does **not** flip host-class IDs.
