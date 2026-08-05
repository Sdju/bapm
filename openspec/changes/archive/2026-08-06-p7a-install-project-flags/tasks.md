## 1. Core options and insecure gate

- [x] 1.1 Extend Install/`RunInstallOptions` types with `force`, `allowInsecure`, `allowInsecureHosts`, `dev`, `only?: "apm" | "mcp"` (no `refresh`; keep `forcedTarget` distinct)
- [x] 1.2 Add core insecure-policy helper: classify `http://`, dual-consent for directs, transitive host allowlist (+ hosts from approved directs when `allowInsecure`), APM-shaped errors
- [x] 1.3 Wire insecure gate into install before download/materialize; fail closed on violations
- [x] 1.4 Validate/normalize `allowInsecureHosts` in core (FQDN); reject invalid hosts fail-closed

## 2. Dev write + resolve union

- [x] 2.1 Extend package-ref append so `dev: true` writes `devDependencies.apm` (create block if needed); default remains `dependencies.apm`
- [x] 2.2 Without positional refs, `dev` is no-op (optional warn); dry-run previews would-add under the correct section
- [x] 2.3 Update `resolveGraph` root to union `dependencies.apm` + `devDependencies.apm`; child walks stay `dependencies` only
- [x] 2.4 Spot-check pack/export still excludes or ignores `devDependencies` without CONFORMANCE churn

## 3. Only-mode and force semantics

- [x] 3.1 Implement `only: "apm"` → skip `configureMcp` / MCP json writes; package path may still run
- [x] 3.2 Implement `only: "mcp"` → skip APM package download/materialize; preserve existing lock MCP restoration where present
- [x] 3.3 Accept `force` on core path; ensure it does not refresh refs, bypass frozen, or disable policy (no collision-skip rewrite; cursor stays overwrite)

## 4. CLI parse and help

- [x] 4.1 Parse `--force`, `--allow-insecure`, repeatable `--allow-insecure-host`, `--dev`, `--only apm|mcp`; reject invalid only/host; unknown flags stay fail-closed
- [x] 4.2 Forward new flags into `coreRunInstall` options; keep P6a flags unchanged
- [x] 4.3 Update `formatInstallHelp`: list new flags; note force ≠ refresh/update and does not bypass frozen/policy; do **not** document `--refresh`

## 5. Tests

- [x] 5.1 Unit: dual-consent HTTP (missing manifest / missing CLI / both present)
- [x] 5.2 Unit: transitive host allowlist block + `--allow-insecure-host` success; invalid hostname parse fail
- [x] 5.3 Unit/CLI: `--dev` writes `devDependencies.apm`; bare install resolves that dep
- [x] 5.4 Unit/CLI: `--only apm` skips MCP configure; `--only mcp` skips APM materialize
- [x] 5.5 Unit/CLI: `--force` accepted; frozen + policy still fail closed with force; help lists flags and omits `--refresh`
