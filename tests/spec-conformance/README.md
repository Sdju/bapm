# Mode B / OpenAPM conformance (bapm)

Machine-readable inventory and generators for the published OpenAPM v0.1 claim.

## Files

| Path | Role |
|------|------|
| `openapm-v0.1.requirements.yml` | Informative mirror of OpenAPM Appendix C requirements (no `.samples` dep) |
| `checklist.yml` | Per-`req-*` triage: `active` \| `skipped` \| `n/a` + citations/fixtures |
| `../fixtures/spec-conformance/` | Vendored §12.4 seed fixtures |

## Regenerate statement

From repo root:

```bash
pnpm run conformance:gen
# or
node scripts/gen-conformance-statement.mjs
```

Emits deterministic `CONFORMANCE.md` and `CONFORMANCE.json` at the repository root.

## Drift gate

```bash
pnpm run conformance:check
# or
node scripts/check-conformance-drift.mjs
```

Regenerates the statement, then fails on `git diff` against the committed
`CONFORMANCE.md` / `CONFORMANCE.json`.

## Claim posture (P3)

- **Consumer** — claimed
- **Producer** — claimed
- **Governance** — floor (local dual-read + gate; remote/`extends` skipped)
- **Registry** — N/A (no host / no rg-001 claim)

Scope out: multi-target beyond cursor, registry host, approve/deny UX, host-class AuthResolver, soft §10 tar.gz-only container (zip + caps shipped), full ADO cascade, full Python Mode B port. Residual `sc-*` skips are security-depth / soft-format gaps (marketplace floor + sc-002/sc-006 claimed).
