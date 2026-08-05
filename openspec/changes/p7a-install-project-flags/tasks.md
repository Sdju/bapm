## 1. Core options and insecure gate

- [ ] 1.1 Extend Install/`RunInstallOptions` types with `force`, `allowInsecure`, `allowInsecureHosts`, `dev`, `only?: "apm" | "mcp"` (no `refresh`; keep `forcedTarget` distinct)
- [ ] 1.2 Add core insecure-policy helper: classify `http://`, dual-consent for directs, transitive host allowlist (+ hosts from approved directs when `allowInsecure`), APM-shaped errors
- [ ] 1.3 Wire insecure gate into install before download/materialize; fail closed on violations
- [ ] 1.4 Validate/normalize `allowInsecureHosts` in core (FQDN); reject invalid hosts fail-closed

## 2. Dev write + resolve union

- [ ] 2.1 Extend package-ref append so `dev: true` writes `devDependencies.apm` (create block if needed); default remains `dependencies.apm`
- [ ] 2.2 Without positional refs, `dev` is no-op (optional warn); dry-run previews would-add under the correct section
- [ ] 2.3 Update `resolveGraph` root to union `dependencies.apm` + `devDependencies.apm`; child walks stay `dependencies` only
- [ ] 2.4 Spot-check pack/export still excludes or ignores `devDependencies` without CONFORMANCE churn

## 3. Only-mode and force semantics

- [ ] 3.1 Implement `only: "apm"` → skip `configureMcp` / MCP json writes; package path may still run
- [ ] 3.2 Implement `only: "mcp"` → skip APM package download/materialize; preserve existing lock MCP restoration where present
- [ ] 3.3 Accept `force` on core path; ensure it does not refresh refs, bypass frozen, or disable policy (no collision-skip rewrite; cursor stays overwrite)

## 4. CLI parse and help

- [ ] 4.1 Parse `--force`, `--allow-insecure`, repeatable `--allow-insecure-host`, `--dev`, `--only apm|mcp`; reject invalid only/host; unknown flags stay fail-closed
- [ ] 4.2 Forward new flags into `coreRunInstall` options; keep P6a flags unchanged
- [ ] 4.3 Update `formatInstallHelp`: list new flags; note force ≠ refresh/update and does not bypass frozen/policy; do **not** document `--refresh`

## 5. Tests

- [ ] 5.1 Unit: dual-consent HTTP (missing manifest / missing CLI / both present)
- [ ] 5.2 Unit: transitive host allowlist block + `--allow-insecure-host` success; invalid hostname parse fail
- [ ] 5.3 Unit/CLI: `--dev` writes `devDependencies.apm`; bare install resolves that dep
- [ ] 5.4 Unit/CLI: `--only apm` skips MCP configure; `--only mcp` skips APM materialize
- [ ] 5.5 Unit/CLI: `--force` accepted; frozen + policy still fail closed with force; help lists flags and omits `--refresh`
