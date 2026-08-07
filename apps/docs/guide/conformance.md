# Conformance & OpenAPM boundary

bapm separates three axes that are easy to conflate:

| Axis                | Meaning                                                 | bapm posture                                                                                                      |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **OpenAPM v0.1**    | Normative wire: manifest, lock, policy, resolve, deploy | Claimed classes in root [`CONFORMANCE.md`](../../../CONFORMANCE.md): Consumer, Producer, Governance; Registry N/A |
| **APM product CLI** | Full microsoft/apm command and adapter surface          | **Not** full product CLI parity — bapm is not a drop-in APM CLI clone                                             |
| **Host targets**    | Where packages materialize                              | **cursor-only** today via target packages (`bapm-integration-cursor`); multi-target later                         |

## Published statement

See the generated root statement:

- [`CONFORMANCE.md`](../../../CONFORMANCE.md) — classes, coverage, **Limitations / non-conformance**
- [`CONFORMANCE.json`](../../../CONFORMANCE.json) — machine-readable twin

Do not treat “OpenAPM claimed” as “every APM CLI feature shipped.”

## Out of scope (aligned with Limitations)

- **multi-target** adapters beyond cursor (later track)
- **registry host** (rg-001 N/A; client-only)
- Interactive **user-local approve/deny** (sc-010), org **executables.deny/deny_all** deny-wins + install≡audit (sc-011), and lockfile **require** vs withheld (sc-012) are **claimed** — not absolute OOS; full APM approve UX extras and hooks/bin/canvas gates remain soft (MCP-only)
- OpenAPM **§10.3 host-class floor is claimed** (PSL eTLD+1 / credential host-class, redirect Auth drop, ambient suppress, https-only git-HTTP attach refuse); **residual Auth depth** (gh CLI / az bearer / credential-helper / try_with_fallback) and soft **tar.gz-only** container (sc-004; zip + size/entry caps ship) remain limitations — not a blanket deferred host-class framing

Also intentional (not bugs): ∩-pick vs APM first-wins, dual-read branding, OpenAPM-strict YAML anchors.
