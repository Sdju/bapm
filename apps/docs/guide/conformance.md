# Conformance & OpenAPM boundary

bapm separates three axes that are easy to conflate:

| Axis | Meaning | bapm posture |
|------|---------|--------------|
| **OpenAPM v0.1** | Normative wire: manifest, lock, policy, resolve, deploy | Claimed classes in root [`CONFORMANCE.md`](../../../CONFORMANCE.md): Consumer, Producer, Governance; Registry N/A |
| **APM product CLI** | Full microsoft/apm command and adapter surface | **Not** full product CLI parity — bapm is not a drop-in APM CLI clone |
| **Host targets** | Where packages materialize | **cursor-only** today via target packages (`bapm-target-cursor`); multi-target later |

## Published statement

See the generated root statement:

- [`CONFORMANCE.md`](../../../CONFORMANCE.md) — classes, coverage, **Limitations / non-conformance**
- [`CONFORMANCE.json`](../../../CONFORMANCE.json) — machine-readable twin

Do not treat “OpenAPM claimed” as “every APM CLI feature shipped.”

## Out of scope (aligned with Limitations)

- **multi-target** adapters beyond cursor (later track)
- **registry host** (rg-001 N/A; client-only)
- **approve/deny** interactive UX and org executable deny-wins fidelity
- Residual OpenAPM **§10 security-depth** gaps (host-class credential scoping / AuthResolver, soft archive zip vs tar.gz + size/entry caps) — marketplace floor exists and does not by itself satisfy these `sc-*` reqs

Also intentional (not bugs): ∩-pick vs APM first-wins, dual-read branding, OpenAPM-strict YAML anchors.
