## 1. Shared identity case rule

- [ ] 1.1 Add shared ASCII repository-coordinate fold helper (host/source aware: github.com, `*.ghe.com`, `GITHUB_HOST`, registry always; others byte-exact; virtual path / `#` excluded)
- [ ] 1.2 Align Resolver `normalizeRepoIdentity` path casing with Lockfile `normalizePackageRepoUrl` under the same disclosed rule
- [ ] 1.3 Export helper for Policy matcher + cover unit cases (GitHub fold, gitlab sensitive, registry fold)

## 2. Policy match (req-pl-018)

- [ ] 2.1 Wire fold into `identityMatchesPattern` / evaluate for allow, deny, and exact require (match-time only; `*` literal in require)
- [ ] 2.2 Truncate case-insensitive prefix before first `**` segment; keep deny-wins and merge byte-exact
- [ ] 2.3 Extend evaluate candidates with optional `host` / `source` (infer github.com for bare `owner/repo`)

## 3. Tests

- [ ] 3.1 Unit tests: mixed-case allow/deny/require on GitHub; deny fail-closed; virtual-path sensitivity; gitlab byte-exact; registry fold; deny-wins after fold
- [ ] 3.2 Unit tests: Resolver/Lockfile identity keys fold GitHub/registry path case and keep unknown hosts distinct
- [ ] 3.3 Acceptance (orch-acceptance): install/lock gate fails closed on mixed-case deny vs mixed-case identity under `enforcement: block`

## 4. Conformance + docs

- [ ] 4.1 Add `req-pl-018` (active) and `req-pl-017` (n/a, ADO) to checklist + informative `openapm-v0.1.requirements.yml`
- [ ] 4.2 Extend `gen-conformance-statement.mjs` to emit `## Repository case rules`; set checklist field; run `conformance:gen` / `conformance:check`
- [ ] 4.3 Brief docs note on policy allow/deny/require case treatment if governance/policy reference exists

## 5. Verify

- [ ] 5.1 Run focused core policy + resolve identity tests; fix regressions
- [ ] 5.2 Confirm no gh-aw / Homebrew / Hermes / grok-cloud changes; Follow-ups remain DEFER-only notes
