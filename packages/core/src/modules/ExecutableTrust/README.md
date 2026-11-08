# ExecutableTrust

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

OpenAPM **sc-009** executable trust for MCP deploy, extended to `bin` and
dependency `hook` deploy.

## Public API

- `parseExecutableGrants(manifest)` — parse `executables.allow`/`deny` + `allowExecutables` alias
- `evaluateExecutableTrust({ grantSurface, packageName, executableType })` — allow / withhold / skip
- `resolveExecutableTrust({ orgExecutables, projectSurface, userSurface, executableType })` — layered deny-wins for `mcp`, `bin`, `hook`
- `resolveBinDeployConsent(...)` — `--trust-bin` overlay for `bin`
- `hasGrantSurface(surface)` — non-absent grant detection

## Vocabulary

| Form                                     | Role                            |
| ---------------------------------------- | ------------------------------- |
| `executables.allow` / `executables.deny` | Preferred wire form (APM)       |
| `allowExecutables`                       | Documented alias (OpenAPM text) |

Empty `allow: {}` still counts as a present grant surface (fail-closed for unapproved deps).

Each package entry is keyed by executable type. The resolver reads the requested
type verbatim, so `executables.allow.<pkg>.hook: true` approves dependency hooks,
while `executables.deny.<pkg>.hook: true` denies them.

```yaml
executables:
  allow:
    "acme/hook-pack":
      hook: true
```
