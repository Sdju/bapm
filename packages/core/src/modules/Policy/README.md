# Policy

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

OpenAPM-shaped governance for `@b-apm/core` (P4): local dual-read + minimal
remote discovery, `extends` resolve/merge with host-class pin, rule evaluate,
and install/lock/update gate helpers.

## Public API

| Export                                     | Kind                                                        |
| ------------------------------------------ | ----------------------------------------------------------- |
| `APM_POLICY_FILE` / `BAPM_POLICY_FILE`     | constants (`apm-policy.yml` / `bapm-policy.yml`)            |
| `DEFAULT_POLICY_PROVIDERS`                 | `["local", "github-owner-dotgithub"]` (documented order)    |
| `discoverPolicyPath`                       | local dual-read / explicit; neither → absent                |
| `discoverPolicyWithProviders`              | ordered providers; `discovery:` / injectable remotes + HTTP |
| `selectProjectRemote`                      | pl-012 origin / single / multi fail-closed / none skip      |
| `parsePolicy` / `loadPolicy`               | mapping-root parse; extends resolve; pl-005/009             |
| `resolvePolicyChain`                       | depth ≤5, cycle reject, host-class pin, §6.4 merge          |
| `mergePolicies` / `hostClassOf`            | §6.4 gate families + eTLD+1 host class                      |
| `evaluateInstallPolicy`                    | deny/allow/require/max_depth/pinned + enforcement           |
| `runPolicyGate` / `assertPolicyGateAllows` | discover → resolve → evaluate; escape hatch                 |
| `isPolicyDisabled`                         | `noPolicy` / `BAPM_POLICY_DISABLE` / `APM_POLICY_DISABLE`   |
| `PolicyError`                              | typed errors                                                |

## Discovery providers (P4)

Default: **local** dual-read first, then **`github-owner-dotgithub`**
(`<owner>/.github/apm-policy.yml` on the implementation-default host,
`github.com`). Selectable via policy `discovery.providers` or gate options.
ADO / multi-candidate cascades are out of scope.

## Extends / merge

- Depth ≤5; cycles rejected with named members (pl-003)
- Host-class pin against leaf (pl-004)
- §6.4 merge for gate families (pl-006); mcp/compilation merge thin/N/A
- `fetch_failure: block` aborts on remote/extends fetch failure (pl-010)

## Gate wiring

Install / lock / mutating update call the gate **after resolve plan** and
**before** `downloadPackages` / durable modules writes (plan → gate → download).
Gate evaluates the **merged** effective document.

## Deferred / out of scope

- Thin `bapm policy status` CLI (diagnostics via install/lock for now)
- Marketplace/plugin, Registry host, approve/deny UX, full ADO cascade
- Multi-target adapters beyond cursor

## Escape

`noPolicy: true`, `BAPM_POLICY_DISABLE=1`, or `APM_POLICY_DISABLE=1` — skip
discovery and checks (not modeled as a provider).
