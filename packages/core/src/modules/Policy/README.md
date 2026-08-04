# Policy

OpenAPM-shaped governance for `@bapm/core` (M8): local dual-read discovery,
parse/validate, rule evaluate, and install/lock/update gate helpers.

## Public API

| Export                                     | Kind                                                      |
| ------------------------------------------ | --------------------------------------------------------- |
| `APM_POLICY_FILE` / `BAPM_POLICY_FILE`     | constants (`apm-policy.yml` / `bapm-policy.yml`)          |
| `DEFAULT_POLICY_PROVIDERS`                 | ordered providers — M8 = `["local"]` only                 |
| `discoverPolicyPath`                       | dual-read / explicit; neither → absent                    |
| `parsePolicy` / `loadPolicy`               | mapping-root parse; enum coerce; pl-005/009               |
| `evaluateInstallPolicy`                    | deny/allow/require/max_depth/pinned + enforcement         |
| `runPolicyGate` / `assertPolicyGateAllows` | discover → evaluate; escape hatch                         |
| `isPolicyDisabled`                         | `noPolicy` / `BAPM_POLICY_DISABLE` / `APM_POLICY_DISABLE` |
| `PolicyError`                              | typed errors                                              |

## Discovery providers (M8)

Registered default: **local dual-read only**. Remote org policy
(`github-owner-dotgithub`) is **deferred N/A** — not required for M8.

## Gate wiring

Install / lock / mutating update call the gate **after resolve plan** and
**before** `downloadPackages` / durable modules writes (plan → gate → download).

## Deferred

- `extends` merge chain (pl-003/006), host-class pin (pl-004)
- Remote fetch + `fetch_failure` remote path (pl-010/012)
- Thin `bapm policy status` CLI (diagnostics via install/lock for now)
- pl-013/014/015/016 security/audit hooks

## Escape

`noPolicy: true`, `BAPM_POLICY_DISABLE=1`, or `APM_POLICY_DISABLE=1` — skip
discovery and checks (not modeled as a provider).
