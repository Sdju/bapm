# OpenAPM Conformance Statement — v0.1 (bapm)

Generator: scripts/gen-conformance-statement.mjs v1
Spec: OpenAPM `v0.1`

This file is generated. Do NOT edit by hand. Run
`pnpm run conformance:gen` (or `node scripts/gen-conformance-statement.mjs`) to regenerate.
Drift gate: `pnpm run conformance:check`.

## Honesty contract

A requirement marked `status=active` is exercised by at least one fixture and/or assertion citation.
A requirement marked `status=skipped` carries a written rationale (debt, not coverage).
A requirement marked `status=n/a` is outside the claimed class surface.

## Conformance classes

| Class | Posture | Notes |
|-------|---------|-------|
| Consumer | **claimed** | Primary claim (cursor deploy matrix; waivers below) |
| Producer | **claimed** | init/pack/pr-004 surface |
| Governance | **claimed** | Ordered providers `local` then `github-owner-dotgithub`; extends resolve/merge + host-class pin |
| Registry | **n/a** | No registry host; req-rg-001 not claimed |

## Coverage summary

| Class | Active | Skipped | N/A |
|-------|-------:|--------:|----:|
| Producer | 12 | 0 | 0 |
| Consumer | 72 | 9 | 0 |
| Governance | 16 | 0 | 0 |
| Registry | 0 | 0 | 1 |

## Limitations / non-conformance

- Multi-target adapters beyond cursor are out of scope
- Registry host / rg-001 not claimed (N/A)
- Writer may canonicalize to bapm.yml / bapm.lock.yaml branding; dual-read accepts OpenAPM wire names
- Intentional OpenAPM-vs-APM diffs (intersection-pick, OpenAPM-strict YAML anchors, lock sort) are limitations not silent passes
- ADO / multi-candidate policy cascades are out of scope
- Interactive user-local approve/deny (sc-010) and org executables.deny/deny_all deny-wins + install≡audit twin (sc-011) + lockfile require presence vs withheld (sc-012) are claimed; full APM approve UX (--all/--recommended/policy explain) and hooks/bin/canvas executable gates remain soft (MCP-only trust surface)
- Claimed PSL eTLD+1 / credential host-class floor with redirect Auth drop and ambient suppress (OpenAPM §10.3; https-only git-HTTP attach refuse also claimed); residual Auth depth beyond that floor remains soft (gh CLI / az bearer / credential-helper / try_with_fallback); pack/registry archives remain zip with default 10k-entry / 100MB uncompressed caps (sc-002); OpenAPM tar.gz-only container format (sc-004) stays soft
- Default discovery providers: local, then github-owner-dotgithub (implementation-default host github.com)
- P6a install UX: frozen keeps lk-015/017/018 integrity; fail-closed MCP config sync vs pins is optional/default-off (SHOULD); --exclude filters MCP configure only, not skip-install

### Scope out

- multi-target
- registry host
- full ADO cascade
- residual Auth depth (gh CLI / az bearer / credential-helper / try_with_fallback)
- soft §10 tar.gz-only container (zip + caps shipped)
- hooks/bin/canvas executable gates (MCP-only)
- full Python Mode B port

## Per-requirement coverage

| Req ID | Keyword | Sec | Class | Status | Citation / fixture |
|--------|---------|-----|-------|--------|--------------------|
| req-cf-001 | MUST | 12.5 | consumer | active | packages/core/tests/spec-conformance/cf-001-round-trip.test.ts · tests/fixtures/spec-conformance/manifest/valid-minimal.yml; tests/fixtures/spec-conformance/manifest/x-extension-roundtrip.yml; tests/fixtures/spec-conformance/lockfile/round-trip-unknown-fields.yml; tests/fixtures/spec-conformance/lockfile/v2-with-registry.yml |
| req-cf-002 | MUST | 12.3 | consumer | active | packages/core/tests/acceptance/p3-openapm-mode-b-conformance/conformance-statement.test.ts; CONFORMANCE.md; CONFORMANCE.json |
| req-ext-001 | MUST | 4.1 | consumer | active | packages/core/tests/spec-conformance/cf-001-round-trip.test.ts · tests/fixtures/spec-conformance/manifest/x-extension-roundtrip.yml; tests/fixtures/spec-conformance/lockfile/round-trip-unknown-fields.yml |
| req-ext-002 | MUST | 4.1 | producer | active | packages/core/tests/producer/emit-serialize.test.ts |
| req-lk-001 | MUST | 5.1 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/spec-conformance/seed-oracles.test.ts · tests/fixtures/spec-conformance/lockfile/v2-with-registry.yml |
| req-lk-002 | MUST | 5.4 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-003 | MUST | 5.2 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-004 | MUST | 5.4 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/spec-conformance/seed-oracles.test.ts · tests/fixtures/spec-conformance/lockfile/v1-git-only.yml |
| req-lk-005 | MUST | 5.5 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-006 | MUST | 5.5 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-007 | SHOULD | 5.5 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-008 | MUST | 5.6 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-009 | MUST | 5.6 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-010 | MUST | 5.6 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-011 | MUST | 5.2 | consumer | active | packages/core/tests/spec-conformance/cf-001-round-trip.test.ts · tests/fixtures/spec-conformance/lockfile/round-trip-unknown-fields.yml |
| req-lk-012 | MUST | 5.2 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-013 | MUST | 5.2 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-014 | MUST | 5.2 | consumer | active | packages/core/tests/spec-conformance/cf-001-round-trip.test.ts · tests/fixtures/spec-conformance/lockfile/round-trip-unknown-fields.yml |
| req-lk-015 | MUST | 5.6.4 | consumer | active | packages/core/tests/lockfile/tree-sha256.test.ts; packages/core/tests/resolve/record-tree-sha256.test.ts |
| req-lk-016 | MUST | 5.2 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-017 | MUST | 5.2 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-018 | SHOULD | 5.5 | consumer | active | packages/core/tests/install/ci-frozen.test.ts; packages/core/tests/acceptance/p2-lk-018-ci-default-frozen/resolve-frozen.test.ts |
| req-lk-019 | MUST | 5.2 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-020 | MUST | 5.2 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-021 | MUST | 5.2 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-lk-022 | MUST | 5.2 | consumer | active | packages/core/tests/lockfile/parse-serialize.test.ts; packages/core/tests/lockfile/discovery.test.ts; packages/core/tests/install/frozen.test.ts |
| req-mf-001 | MUST | 4.1 | producer | active | packages/core/tests/producer/emit-serialize.test.ts; packages/core/tests/manifest/validate.test.ts |
| req-mf-002 | MUST | 4.1 | producer | active | packages/core/tests/producer/emit-serialize.test.ts; packages/core/tests/manifest/validate.test.ts |
| req-mf-003 | MUST | 4.1 | producer | active | packages/core/tests/producer/emit-serialize.test.ts; packages/core/tests/manifest/validate.test.ts |
| req-mf-004 | SHOULD | 4.1 | producer | active | packages/core/tests/producer/emit-serialize.test.ts; packages/core/tests/manifest/validate.test.ts |
| req-mf-005 | MUST | 4.2.1 | producer | active | packages/core/tests/producer/emit-serialize.test.ts; packages/core/tests/manifest/validate.test.ts |
| req-mf-006 | MUST | 4.1 | consumer | active | packages/core/tests/spec-conformance/cf-001-round-trip.test.ts; packages/core/tests/spec-conformance/seed-oracles.test.ts · tests/fixtures/spec-conformance/manifest/valid-minimal.yml |
| req-mf-007 | MUST | 4.3.1 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-mf-008 | MUST | 4.3.3 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-mf-009 | MUST | 4.3.4 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-mf-010 | MUST | 4.3.2 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-mf-011 | MUST | 4.3.2 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-mf-012 | MUST | 4.3.6 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-mf-013 | MUST | 4.5 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-mf-014 | MUST | 4.2.3 | producer | active | packages/core/tests/producer/emit-serialize.test.ts; packages/core/tests/manifest/validate.test.ts |
| req-mf-015 | MUST | 4.2.3 | producer | active | packages/core/tests/producer/emit-serialize.test.ts; packages/core/tests/manifest/validate.test.ts |
| req-mf-016 | MUST | 4.3.5 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/acceptance/mf-local-path-root-boundary/local-path-root-boundary.test.ts |
| req-mf-017 | MUST | 4.7 | producer | active | packages/core/tests/producer/emit-serialize.test.ts; packages/core/tests/manifest/validate.test.ts |
| req-mf-018 | MUST | 4.6.1 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-mf-019 | MUST | 4.2.4 | consumer | active | packages/core/tests/spec-conformance/cf-001-round-trip.test.ts; packages/core/tests/spec-conformance/seed-oracles.test.ts · tests/fixtures/spec-conformance/manifest/x-extension-roundtrip.yml |
| req-mf-020 | MUST | 4.1 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-yaml-anchor-alias.yml |
| req-mf-021 | MUST | 4.8 | producer | active | packages/core/tests/producer/emit-serialize.test.ts; packages/core/tests/manifest/validate.test.ts |
| req-mf-022 | MUST | 4.3.2 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-mf-023 | MUST | 4.5 | consumer | active | packages/core/tests/spec-conformance/seed-oracles.test.ts; packages/core/tests/manifest/validate.test.ts · tests/fixtures/spec-conformance/manifest/invalid-missing-name.yml; tests/fixtures/spec-conformance/manifest/invalid-no-source-key.yml; tests/fixtures/spec-conformance/manifest/invalid-source-kind.yml; tests/fixtures/spec-conformance/manifest/invalid-registry-scheme.yml; tests/fixtures/spec-conformance/manifest/invalid-registries-typo.yml |
| req-pl-001 | MUST | 6.1 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts; packages/core/tests/spec-conformance/seed-oracles.test.ts · tests/fixtures/spec-conformance/policy/security-integrity.yml |
| req-pl-002 | MUST | 6.2 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts; packages/core/tests/spec-conformance/seed-oracles.test.ts · tests/fixtures/spec-conformance/policy/security-integrity.yml |
| req-pl-003 | MUST | 6.4 | governance | active | packages/core/tests/acceptance/p4-governance-remote-extends/extends-resolve.test.ts; packages/core/tests/acceptance/p4-governance-remote-extends/merge-host-pin.test.ts · tests/fixtures/spec-conformance/policy/valid-extends.yml; tests/fixtures/spec-conformance/policy/invalid-extends-cycle.yml |
| req-pl-004 | MUST | 6.4 | governance | active | packages/core/tests/acceptance/p4-governance-remote-extends/merge-host-pin.test.ts; packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts |
| req-pl-005 | MUST | 6.5 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts |
| req-pl-006 | MUST | 6.4 | governance | active | packages/core/tests/acceptance/p4-governance-remote-extends/merge-host-pin.test.ts; packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts |
| req-pl-007 | MUST | 6.3.1 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts |
| req-pl-008 | MUST | 6.3.1 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts |
| req-pl-009 | MUST | 6.6 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts |
| req-pl-010 | MUST | 6.2 | governance | active | packages/core/tests/acceptance/p4-governance-remote-extends/remote-discovery.test.ts; packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts |
| req-pl-011 | MUST | 6.1.1 | governance | active | packages/core/tests/acceptance/p4-governance-remote-extends/providers-parse.test.ts; packages/core/tests/acceptance/p4-governance-remote-extends/remote-discovery.test.ts; packages/core/tests/acceptance/p4-governance-remote-extends/conformance-governance.test.ts · tests/fixtures/spec-conformance/policy/valid-extends.yml; tests/fixtures/spec-conformance/policy/invalid-extends-cycle.yml |
| req-pl-012 | MUST | 6.1.1 | governance | active | packages/core/tests/acceptance/p4-governance-remote-extends/remote-discovery.test.ts · tests/fixtures/spec-conformance/policy/valid-extends.yml; tests/fixtures/spec-conformance/policy/invalid-extends-cycle.yml |
| req-pl-013 | MUST | 6.8 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts; packages/core/tests/spec-conformance/seed-oracles.test.ts · tests/fixtures/spec-conformance/policy/security-integrity.yml |
| req-pl-014 | MUST | 6.8 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts; packages/core/tests/spec-conformance/seed-oracles.test.ts · tests/fixtures/spec-conformance/policy/security-integrity.yml |
| req-pl-015 | MUST | 6.3.5 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts |
| req-pl-016 | MUST | 6.8 | governance | active | packages/core/tests/policy/parse.test.ts; packages/core/tests/policy/discovery.test.ts; packages/core/tests/policy/evaluate.test.ts; packages/core/tests/policy/install-gate.test.ts |
| req-pr-001 | MUST | 8.2 | consumer | active | packages/core/tests/primitives/primitives.test.ts; packages/core/tests/install/install-pipeline.test.ts |
| req-pr-002 | MUST | 8.3 | consumer | active | packages/core/tests/primitives/primitives.test.ts; packages/core/tests/install/install-pipeline.test.ts |
| req-pr-003 | MUST | 8.3 | consumer | active | packages/core/tests/primitives/primitives.test.ts; packages/core/tests/install/install-pipeline.test.ts |
| req-pr-004 | MUST | 7.8 | producer | active | packages/core/tests/pack/pack-archive.test.ts; packages/core/tests/pack/release-gate.test.ts |
| req-pr-005 | SHOULD | 7.8 | producer | active | packages/core/tests/pack/release-gate.test.ts |
| req-rg-001 | MUST | 11.3.3 | registry | n/a |  — Registry host not shipped; class N/A (no rg-001 claim) |
| req-rs-001 | MUST | 7.2 | consumer | active | packages/core/tests/resolve/intersection-pick.test.ts |
| req-rs-002 | MUST | 7.3 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-003 | MUST | 7.3 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-004 | MUST | 7.5 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-005 | MUST | 7.6 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-006 | MUST | 7.2 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-007 | MUST | 7.3 | consumer | active | packages/core/tests/spec-conformance/semver-dialect.test.ts; packages/core/tests/resolve/intersection-pick.test.ts · tests/fixtures/spec-conformance/resolution/semver-dialect.json |
| req-rs-008 | MUST | 7.1 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-009 | MUST | 7.5.1 | consumer | active | packages/core/tests/registry/resolve-install.test.ts; packages/core/tests/registry/registry-client.test.ts |
| req-rs-010 | MUST | 7.2 | consumer | active | packages/core/tests/resolve/intersection-pick.test.ts |
| req-rs-011 | MUST | 7.7 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-012 | MUST | 7.7 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-013 | MUST | 7.2 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-014 | MUST | 7.3.1 | consumer | active | packages/core/tests/spec-conformance/semver-dialect.test.ts; packages/core/tests/resolve/intersection-pick.test.ts · tests/fixtures/spec-conformance/resolution/semver-dialect.json |
| req-rs-015 | MUST | 7.5 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-rs-016 | MUST | 7.2 | consumer | active | packages/core/tests/resolve/resolve.test.ts; packages/core/tests/resolve/download-lock.test.ts; packages/core/tests/resolve/e2e.test.ts |
| req-sc-001 | MUST | 10.4 | consumer | active | packages/core/tests/extras/public-api.test.ts |
| req-sc-002 | MUST | 10.9 | consumer | active | packages/core/tests/pack/safe-extract-pack.test.ts; packages/core/tests/registry/safe-extract-registry.test.ts |
| req-sc-003 | MUST | 10.3 | consumer | active | packages/core/tests/auth/redirect-auth-drop.test.ts; packages/core/tests/auth/resolve-per-class.test.ts |
| req-sc-004 | MUST | 10.5 | consumer | skipped |  — Soft: registry/pack archives remain zip with default 10k-entry / 100MB uncompressed caps enforced; OpenAPM tar.gz-only / reject-zip container format still soft debt (not claimed) |
| req-sc-005 | MUST | 10.3 | consumer | active | packages/core/tests/auth/credential-host-class.test.ts |
| req-sc-006 | MUST | 4.2.3 | consumer | active | packages/core/tests/manifest/registries-insecure.test.ts |
| req-sc-007 | MUST | 10.3 | consumer | active | packages/core/tests/pack/pack-archive.test.ts |
| req-sc-008 | SHOULD | 10.3 | consumer | active | packages/core/tests/auth/git-https-refuse.test.ts |
| req-sc-009 | MUST | 10.13 | consumer | active | packages/core/tests/extras/public-api.test.ts |
| req-sc-010 | MUST | 10.13 | consumer | active | packages/core/tests/executable-trust/user-store.test.ts; packages/cli/tests/mcp/approve-deny.test.ts |
| req-sc-011 | MUST | 10.14 | consumer | active | packages/core/tests/executable-trust/resolve-deny-wins.test.ts; packages/core/tests/policy/executables-parse-merge.test.ts; packages/core/tests/executable-trust/install-audit-twin.test.ts |
| req-sc-012 | MUST | 10.14 | consumer | active | packages/core/tests/executable-trust/require-presence-withheld.test.ts |
| req-sc-013 | MUST | 10.3 | consumer | active | packages/core/tests/auth/overlap-ambient.test.ts |
| req-tg-001 | MUST | 8.4 | consumer | active | packages/core/tests/install/target-materialize.test.ts; packages/core/tests/install/cursor-e2e.test.ts |
| req-tg-002 | MUST | 8.5 | consumer | skipped |  — Out of scope for P3: multi-target adapters beyond cursor |
| req-tg-003 | MUST | 8.5 | consumer | skipped |  — Out of scope for P3: multi-target adapters beyond cursor |
| req-tg-004 | MUST | 4.2.1 | consumer | active | packages/core/tests/manifest/validate.test.ts |
| req-tg-005 | MUST | 8.5 | consumer | skipped |  — Out of scope for P3: multi-target adapters beyond cursor |
| req-tg-006 | MUST | 8.5 | consumer | skipped |  — Out of scope for P3: multi-target adapters beyond cursor |
| req-tg-007 | MUST | 8.5 | consumer | skipped |  — Out of scope for P3: multi-target adapters beyond cursor |
| req-tg-008 | MUST | 8.5.3 | consumer | skipped |  — Out of scope for P3: multi-target adapters beyond cursor |
| req-tg-009 | MUST | 8.5.1 | consumer | skipped |  — Out of scope for P3: multi-target adapters beyond cursor |
| req-tg-010 | MUST | 8.5.4 | consumer | skipped |  — Out of scope for P3: multi-target adapters beyond cursor |

## Waivers

- **req-rg-001** (n/a): Registry host not shipped; class N/A (no rg-001 claim)
- **req-sc-004** (skipped): Soft: registry/pack archives remain zip with default 10k-entry / 100MB uncompressed caps enforced; OpenAPM tar.gz-only / reject-zip container format still soft debt (not claimed)
- **req-tg-002** (skipped): Out of scope for P3: multi-target adapters beyond cursor
- **req-tg-003** (skipped): Out of scope for P3: multi-target adapters beyond cursor
- **req-tg-005** (skipped): Out of scope for P3: multi-target adapters beyond cursor
- **req-tg-006** (skipped): Out of scope for P3: multi-target adapters beyond cursor
- **req-tg-007** (skipped): Out of scope for P3: multi-target adapters beyond cursor
- **req-tg-008** (skipped): Out of scope for P3: multi-target adapters beyond cursor
- **req-tg-009** (skipped): Out of scope for P3: multi-target adapters beyond cursor
- **req-tg-010** (skipped): Out of scope for P3: multi-target adapters beyond cursor
