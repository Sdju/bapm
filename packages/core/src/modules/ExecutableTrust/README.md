# ExecutableTrust

OpenAPM **sc-009** executable trust for MCP deploy.

## Public API

- `parseExecutableGrants(manifest)` — parse `executables.allow`/`deny` + `allowExecutables` alias
- `evaluateExecutableTrust({ grantSurface, packageName, executableType })` — allow / withhold / skip
- `hasGrantSurface(surface)` — non-absent grant detection

## Vocabulary

| Form                                     | Role                            |
| ---------------------------------------- | ------------------------------- |
| `executables.allow` / `executables.deny` | Preferred wire form (APM)       |
| `allowExecutables`                       | Documented alias (OpenAPM text) |

Empty `allow: {}` still counts as a present grant surface (fail-closed for unapproved deps).
