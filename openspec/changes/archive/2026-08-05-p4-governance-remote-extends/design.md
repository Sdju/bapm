## Context

See `proposal.md` for motivation. Policy today (`packages/core/src/modules/Policy/`) is M8 local floor: `DEFAULT_POLICY_PROVIDERS = ["local"]`, dual-read discover, parse (accepts `extends` but does not resolve), evaluate, gate. M8 archive D8 deferred extends/remote. P3 CONFORMANCE marks Governance **floor** and skips pl-003/011/012; pl-004/006 are soft-active without merge/host-pin (honesty debt). Normative OpenAPM §6; APM `policy/inheritance.py` + `discovery.py` are behavior references only. Criteria: `.samples/apm-knowledge/topics/p4-governance-criteria.md`.

## Goals / Non-Goals

**Goals:**
- Extends resolve + merge + host-class pin; remote provider that unblocks full Governance claim
- Gate/load path uses merged effective policy; pl-010 remote/`extends` fail-closed
- Regenerate CONFORMANCE: Governance claimed; activate pl-003/011/012; honest pl-004/006
- Acceptance RED→GREEN for chain + mocked remote

**Non-Goals (design-level):**
- Porting APM’s full org cascade (`.apm` / `_apm` / ADO Contents) or discovery cache sophistication
- multi-target, marketplace/plugin, Registry host, approve/deny UX
- Expanding mcp/compilation gate evaluation beyond documenting thin/N/A merge
- Hand-editing CONFORMANCE.md

## Decisions

### D1: Minimal remote provider = `github-owner-dotgithub` only
- **Choice:** Ship OpenAPM-named provider fetching `<owner>/.github/apm-policy.yml` on the project remote host when it equals the implementation-default host (document default host, e.g. `github.com`). No ADO / multi-candidate cascade in P4.
- **Why:** Criteria prefer minimal OpenAPM-aligned provider that unblocks full claim; APM GitHub+ADO is scope creep.
- **Alternatives:** Forever floor / abandon claim — rejected (criteria assume full claim path). Full APM cascade — deferred.

### D2: Default provider order `["local", "github-owner-dotgithub"]`
- **Choice:** Local dual-read first; remote only when local yields absent (and remotes allow). Document order in CONFORMANCE (pl-011).
- **Why:** Preserves M8 local-policy UX; still registers a real remote provider for claim honesty. Selectable via `discovery:`.
- **Alternatives:** Remote-first (closer to org-governance-first) — acceptable later via documented default flip; not required for claim.

### D3: Extends resolve module beside discover/parse
- **Choice:** New Policy helpers (e.g. `resolve.ts` / `merge.ts` / `hostClass.ts`) called from load/gate after leaf discovery; public exports via `Policy/index.ts`. FEOD: stay inside `modules/Policy/`.
- **Why:** Keeps Install thin; mirrors Manifest/Lockfile boundaries.
- **Alternatives:** Inline in gate only — rejected (harder unit testing / reuse).

### D4: OpenAPM §6.4 merge over APM fetch_failure drift
- **Choice:** Implement merge table per OpenAPM: `fetch_failure` = **child overrides if set**; `enforcement` stricter-wins; allow ∩; deny/require ∪; max_depth min; etc. Do **not** copy APM `inheritance.py` escalate-on-fetch_failure if it contradicts §6.4.
- **Why:** Honesty / Mode B claim is against OpenAPM, not APM bugs.
- **Alternatives:** Blind APM port — rejected for fetch_failure.

### D5: Host-class pin using eTLD+1 (+ local class)
- **Choice:** Host class = registrable domain (eTLD+1) of the fetch host for remote docs; leaf local file inherits project remote’s class when a remote exists, else a synthetic `local` class. Cross-class extends → reject (pl-004).
- **Why:** Matches OpenAPM §10.3 definition without full credential-isolation rewrite.
- **Alternatives:** String-equal hostname only — weaker than PSL; full sc-013 credential matrix — out of Governance P4 scope.

### D6: Extends ref forms (minimal)
- **Choice:** Support (1) relative/local paths, (2) `owner/repo` → Contents fetch of `apm-policy.yml` on leaf host class, (3) optional https URL same host class. Fixture `valid-extends.yml` (`contoso-enterprise/policy`) resolved via injectable fetcher in tests.
- **Why:** Enough for pl-003/004/006 + fixtures without APM org-hub heuristics.
- **Alternatives:** Only local relative extends — insufficient for remote claim / valid-extends fixture.

### D7: pl-012 via injectable git-remote reader
- **Choice:** Abstract `listGitRemotes(cwd)`; production uses `git remote -v` (or equivalent); tests inject origin/single/multi/none cases.
- **Why:** Deterministic acceptance without real network/git state.
- **Alternatives:** Parse `.git/config` only — fragile; skip pl-012 — blocks claim.

### D8: Network I/O injectable; default fail-closed under fetch_failure:block
- **Choice:** Provider/extends HTTP via injectable fetcher (headers/host-class aware). Unit/acceptance mock 404/network errors. Effective `fetch_failure: block` aborts gate before durable writes (pl-010).
- **Why:** No flaky CI; matches install-gate ordering.
- **Alternatives:** Live GitHub in CI — rejected.

### D9: CONFORMANCE via generator only
- **Choice:** Update Mode B / citation inputs so `conformance:gen` emits Governance **claimed**, activates pl-003/011/012, and points pl-004/006 at merge/host-pin tests; run `conformance:check`.
- **Why:** Criteria forbid hand-edit drift.
- **Alternatives:** Manual CONFORMANCE edit — rejected.

### D10: pl-015 leave as-is if citations honest
- **Choice:** Verify existing pl-015 citations remain accurate for local unmanaged audit completeness; no new P4 work unless citations are false.
- **Why:** Criteria open question; not on remote/extends DoD bar.
- **Alternatives:** Expand unmanaged audit — out of scope.

## Risks / Trade-offs

- [Claim without real remote code path] → Ship `github-owner-dotgithub` + mocked tests; never mark Governance claimed on local-extends-only.
- [Soft pl-004/006] → Same change must land merge + host-pin before activating citations.
- [APM merge drift on fetch_failure] → Follow OpenAPM table; note intentional APM divergence in design/CONFORMANCE limitations if needed.
- [PSL dependency weight] → Prefer small helper or existing dep; document approximate eTLD+1 if a tiny allowlist of common hosts is used for tests — but production pin must reject obvious cross-host (github.com vs gitlab.com).
- [Scope creep into ADO] → Explicit non-goal; refuse cascade PRs in this change.

## Migration Plan

1. Add resolve/merge/host-class + remote provider behind Policy public API; unit tests green.
2. Wire load/gate to discovery → resolve → evaluate; keep `--no-policy` escape.
3. Activate Mode B extends fixtures + regenerate CONFORMANCE; flip Governance claimed.
4. Acceptance suite (orchestrate) then promote.
5. Rollback = prior release: local-only providers; no data migration (policy files additive).

## Open Questions

- Exact PSL library vs minimal host-class helper for common hosts — implementer choice if reject tests cover github.com ≠ other registrable domains.
- Whether `discovery:` lives only on leaf policy or also in manifest project config — prefer policy `discovery:` per OpenAPM note; manifest knob only if already present and cheap.
