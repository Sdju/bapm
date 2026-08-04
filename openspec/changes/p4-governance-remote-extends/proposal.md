## Why

After P3, bapm publishes Consumer + Producer claimed and Governance as a **floor**: local dual-read + install gate only, with `extends` / remote providers skipped. That blocks an honest **full Governance** claim. Soft-active rows for pl-004 / pl-006 also over-claim today (no merge / host-class pin). Closing remote discovery + `extends` inheritance is the remaining OpenAPM §6 MUST bar for Governance.

## What Changes

- Resolve `extends:` chains with depth ≤5 and cycle rejection (**pl-003**); exercise `valid-extends` / `invalid-extends-cycle` fixtures for real (not schema-only).
- Merge effective policy per OpenAPM §6.4 table (**pl-006**) for families used by the install gate (`enforcement`, `fetch_failure`, `dependencies.*`); document thin/N/A for unevaluated families (mcp/compilation) if not gated.
- Enforce host-class pin on `extends` refs against the **leaf** policy (**pl-004**); reject cross-host-class extends.
- Pluggable ordered discovery providers (**pl-011**): keep `local` dual-read; ship minimal remote provider **`github-owner-dotgithub`** (OpenAPM-named: `<owner>/.github/apm-policy.yml` on the project remote’s host when it matches the implementation-default host). Default order documented in CONFORMANCE. **Product decision:** minimal OpenAPM-aligned remote provider — **not** APM’s full GitHub+ADO / `.apm`/`_apm` cascade.
- When remote discovery is enabled: **pl-012** origin / single-remote / fail-closed multi-remote selection (mocked git remotes in tests).
- **pl-010**: fail-closed when `fetch_failure: block` and remote or transitive `extends` fetch/parse fails.
- Regenerate CONFORMANCE via `conformance:gen`: Governance **claimed** (drop “floor”); pl-003/011/012 → `active` with honest citations; reconcile pl-004/006 to real merge/host-pin evidence; `conformance:check` green.
- Install/lock/update gate consumes the **merged** effective policy (not a single unresolved leaf doc).
- **Non-goals:** multi-target / tg-* beyond cursor; marketplace/plugin; Registry host rg-001; `approve`/`deny` exec UX; full APM ADO / multi-candidate cascade unless trivially free; S5 docs-only sync; inventing full claim without remote provider.

## Capabilities

### New Capabilities

- `policy-extends-resolve`: Resolve and merge `extends` chains (depth/cycle, host-class pin, §6.4 merge for gate families) into one effective policy document.
- `policy-remote-discovery`: Ordered selectable providers including `local` + minimal `github-owner-dotgithub`; pl-012 remote identity; pl-010 remote/`extends` fetch_failure:block path.

### Modified Capabilities

- `policy-dual-file-discovery`: Default provider list widens from local-only to documented ordered list including the remote provider; dual-read semantics for the `local` provider unchanged.
- `policy-yaml-parse`: Preserve/validate `extends` and `discovery:` (provider selection) as first-class fields feeding resolve/discovery (still warn on unknown keys).
- `policy-install-gate`: Gate loads via discovery → extends resolve/merge → evaluate; abort on fetch_failure:block for remote/extends failures before durable writes.
- `openapm-conformance-statement`: Governance class upgrades from floor to **claimed**; pl-003/011/012 active; honesty contract no longer requires documenting remote/`extends` as unclaimed.

## Impact

- `@bapm/core` `modules/Policy/`: new resolve/merge + remote provider + host-class helpers; gate/load wiring; README deferred list shrinks.
- Unit tests under `packages/core/tests/policy/`; Mode B / seed-oracle tests activate extends fixtures; CONFORMANCE.md/json regenerated (no hand-edit).
- CLI unchanged in surface (`--policy` / `--no-policy`); behavior gains remote discovery when providers enabled.
- Acceptance suite (orchestrate TDD) covers chain merge + mocked remote fetch; no multi-target work.
- Follow-on out of scope: S5 docs sync, ADO cascade, marketplace, Registry host.
