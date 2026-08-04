## 1. Parse and model prep

- [ ] 1.1 Expose `extends` and optional `discovery:` on the Policy model/parse path without unknown-key warnings; unit-test preservation
- [ ] 1.2 Update `DEFAULT_POLICY_PROVIDERS` to `["local", "github-owner-dotgithub"]` and document constants/types for provider ids

## 2. Extends resolve and merge

- [ ] 2.1 Implement chain walk with depth ≤5 and cycle detection (pl-003); fail with diagnostics naming members
- [ ] 2.2 Implement host-class pin against leaf (pl-004); reject cross-host-class extends with tests
- [ ] 2.3 Implement §6.4 merge for gate families (`enforcement`, `fetch_failure` child-override, allow∩, deny/require∪, max_depth min, pinned OR); unit-test table cases
- [ ] 2.4 Wire injectable ancestor fetcher for `owner/repo` / URL / relative path refs; exercise `valid-extends` / `invalid-extends-cycle` fixtures

## 3. Remote discovery providers

- [ ] 3.1 Implement ordered provider runner + `discovery:` selection (pl-011); keep `local` dual-read semantics
- [ ] 3.2 Implement minimal `github-owner-dotgithub` fetcher (implementation-default host only); injectable HTTP
- [ ] 3.3 Implement pl-012 git remote selection (`origin` / single / multi fail-closed / none skip) with injectable remote list
- [ ] 3.4 Implement pl-010: when effective `fetch_failure: block`, remote or transitive extends fetch/parse failure aborts fail-closed

## 4. Gate and load wiring

- [ ] 4.1 Change load/gate path to discover → resolve/merge → evaluate; ensure install/lock/update use merged effective policy before durable writes
- [ ] 4.2 Preserve `--no-policy` / env escape; update Policy README (drop deferred extends/remote; note thin mcp/compilation merge N/A)

## 5. Conformance and Mode B evidence

- [ ] 5.1 Activate Mode B / seed-oracle assertions for extends fixtures; add citations for pl-003/004/006/010/011/012
- [ ] 5.2 Update generator inputs so Governance is **claimed** (not floor); regenerate via `conformance:gen`; ensure `conformance:check` green
- [ ] 5.3 Verify pl-015 citations remain honest (no silent over-claim); fix citations only if false

## 6. Verification

- [ ] 6.1 Run Policy unit tests + affected install/lock gate tests green
- [ ] 6.2 Confirm acceptance suite (orchestrate) can cover chain merge + mocked remote without multi-target work
