## Context

See `proposal.md` — Why. Today `resolveExecutableTrust` already accepts typed grant entries (`bin: true`) and is wired only for MCP deploy. Install CLI has no `--trust-bin` / `--no-trust-bin`. CONFORMANCE lists hooks/bin/canvas as soft MCP-only. Upstream APM 0.29 treats flags as per-invocation override on the executables ladder; non-interactive / frozen defaults to no bin deploy without consent or allow.

## Goals / Non-Goals

**Goals:**

- CLI + core consent plumbing with APM-shaped defaults (non-interactive skip; interactive warn+deploy when ladder allows).
- Reuse `resolveExecutableTrust(..., executableType: "bin")` — no parallel policy store.
- Gate real skip/deploy for discovered dependency `bin/` so flags are observable in tests.
- Honest Limitations: bin gated; hooks/canvas still soft.

**Non-Goals:**

- Full Claude global `-g` PATH product surface; hooks/canvas gates; approve UX expansion; follow-up parity slices listed in the proposal.

## Decisions

### D1: Consent as three-state invocation overlay

- **Choice:** Core option `trustBin: "allow" | "deny" | "default"` (names flexible). CLI maps `--trust-bin` → `allow`, `--no-trust-bin` → `deny`, neither → `default`. Effective deploy = `ladderAllows && (trustBin === "allow" || (trustBin === "default" && interactiveDefaultAllows) || (trustBin === "default" && !interactive && ladderExplicitAllow))` with interactiveDefaultAllows = true when interactive and ladder outcome is allow|skip; non-interactive `default` requires explicit project/user allow (not skip).
- **Why:** Matches APM “flags only when ladder permits” and “non-interactive default = no-trust-bin” without inventing grants from the flag alone.
- **Alternatives:** Flag-only gate ignoring ExecutableTrust — rejected (duplicates policy, breaks deny-wins). Always require grant surface for bin like MCP fail-closed — rejected for interactive APM parity (warn+deploy when no surface).

### D2: Non-interactive detection

- **Choice:** Treat as non-interactive when any of: truthy `CI` (same truthiness as frozen CI-default), `BAPM_NON_INTERACTIVE` truthy, `stdin` not a TTY (injectable for tests), or effective frozen on. Prefer injectable `isInteractive` / env on install options for tests.
- **Why:** Aligns with APM security doc (piped, `--frozen`) and existing CI frozen semantics.
- **Alternatives:** Only `CI` — too narrow vs APM. Only TTY — misses CI=true with TTY in some runners.

### D3: Bin discovery + thin materialize

- **Choice:** During install, discover package-root `bin/` (files; no traversal outside package root) for dependency packages that participate in plugin/marketplace materialize. When effective consent allows, copy/symlink into a documented deploy root beside the package’s materialized skill/plugin tree (host-agnostic helper under Install or Primitives; integrations MAY refine later). When withheld, skip writes + diagnostic. Do **not** require `-g` for this slice.
- **Why:** Flags need an observable deploy/skip path; full global Claude PATH contract is out of scope.
- **Alternatives:** Gate-only stubs with no filesystem deploy — weaker APM parity and harder acceptance. Full `-g` Claude skills PATH — out of scope / product surface.

### D4: Soft honesty update, not second ladder

- **Choice:** Modify `executable-mcp-trust` soft requirement; update CONFORMANCE / limitations-honesty tests to drop bin from the ungated trio. Keep MCP gate unchanged.
- **Why:** Proposal requires no policy duplication; grant maps already support typed `bin`.
- **Alternatives:** New `bin_deploy` policy noun — rejected (APM deprecated alias; bapm should not revive).

### D5: FEOD / CLI shape

- **Choice:** Extend existing Install module parse/help only; no new CLI module. Forward into `RunInstallOptions`. Optional thin `resolveBinDeployConsent` helper in `ExecutableTrust` or Install for testability.
- **Why:** Same pattern as `--trust-transitive-mcp` / `--allow-insecure`.

## Risks / Trade-offs

- [Thin bin deploy ≠ full APM global PATH] → Mitigation: document destination; follow-ups can deepen host-specific PATH without changing consent rules.
- [Interactive warn+deploy surprises CI-like local TTY] → Mitigation: document non-interactive signals; `--no-trust-bin` and frozen/CI remain safe defaults.
- [Limitations-honesty / Mode B soft wording churn] → Mitigation: single coordinated string update in CONFORMANCE + existing honesty tests.
- [approve/deny today MCP-oriented UX] → Mitigation: typed `bin` in grant maps is enough; expanding approve CLI prompts is non-goal.

## Migration Plan

- No lockfile format bump required.
- Docs/help only for operators; no forced rematerialize.
- Rollback: remove flags and restore soft honesty wording (unlikely once shipped).

## Open Questions

None — interactive vs non-interactive defaults locked to APM security model + parent criteria.
