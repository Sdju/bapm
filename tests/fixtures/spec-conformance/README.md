# OpenAPM v0.1 conformance fixtures (seed) — vendored for bapm

This directory holds OpenAPM §12.4 seed conformance fixtures, vendored into
bapm so Mode B CI does **not** depend on `.samples/apm` (gitignored).

## Provenance

| Field              | Value                                                            |
| ------------------ | ---------------------------------------------------------------- |
| Spec               | OpenAPM **v0.1** (§12.4 fixture layout)                          |
| Upstream path      | `microsoft/apm` → `tests/fixtures/spec-conformance/`             |
| Local sample clone | `.samples/apm/tests/fixtures/spec-conformance/` (reference only) |
| Vendored into      | `tests/fixtures/spec-conformance/` (this tree, committed)        |

Refresh only with intentional PRs when aligning to a newer OpenAPM seed.

## Layout

| Directory                        | Purpose                                                 |
| -------------------------------- | ------------------------------------------------------- |
| `manifest/`                      | `apm.yml` fixtures (valid / invalid / round-trip)       |
| `lockfile/`                      | `apm.lock.yaml` fixtures including v1, v2, round-trip   |
| `policy/`                        | `apm-policy.yml` fixtures (local floor + extends seeds) |
| `resolution/semver-dialect.json` | Canonical semver-range → tag-set table (req-rs-007)     |
| `integrity/`                     | Extra APM integrity oracles (optional citations)        |

## Binding

- Mode B checklist: `tests/spec-conformance/checklist.yml`
- Requirements mirror: `tests/spec-conformance/openapm-v0.1.requirements.yml`
- Vitest harness: `packages/core/tests/spec-conformance/`
- Statement: repo-root `CONFORMANCE.md` + `CONFORMANCE.json`
