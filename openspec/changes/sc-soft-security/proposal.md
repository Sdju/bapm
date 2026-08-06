## Why

Mode B still skips `req-sc-002` (zip-slip depth) and `req-sc-006` (`registries.*.insecure` + http gate) after the honesty floor and thin hosts-auth. Product call is **implement-then-claim**: close the actionable soft §10 gaps with real code + Mode B citations in one change, without faking claims or activating deferred §10.3 / approve IDs.

## What Changes

- Shared **safe-extract** for Pack + Registry zip materialize: reject `..` / absolute / symlink (zip unix mode / external_attr); reject hardlink / non-regular where the format exposes it; fail-closed cleanup of partial dest; default caps **10 000 entries** and **100 MB** uncompressed.
- Accept `registries.*.insecure` boolean (mf-015 allowlist stays `url` / `aliases` / `insecure` / `x-*`); parse-time `http://` gate unless `insecure: true` **or** host is loopback / `::1` / RFC1918; diagnostic **names** the registry.
- Flip CONFORMANCE checklist: `req-sc-002` + `req-sc-006` → `active` with truthful Mode B citations; refresh `req-sc-004` skipped rationale (caps on zip present; container/format still soft); leave `req-sc-003` / `005` / `008` / `010`–`013` skipped; leave `req-sc-001` / `007` / `009` active unchanged.
- Regenerate `CONFORMANCE.md` / `CONFORMANCE.json` via `conformance:gen`; `conformance:check` green; Limitations soft §10 text accurate (zip container soft; §10.3 still deferred).
- Acceptance under `**/sc-soft-security/` covering extract + insecure gate + checklist claim set.

**Non-goals:** claim or implement sc-004 format migration (tar.gz-only / reject zip); sc-003/005/008/013 host-class AuthResolver; sc-010–012 approve/org deny; weaken lk-013 digest-before-extract; marketplace URL Auth redesign.

## Capabilities

### New Capabilities

- `archive-safe-extract`: Shared fail-closed zip extract policy (path-escape, symlink/hardlink reject, entry/size caps, partial-dest cleanup) used by Pack extract and Registry materialize.

### Modified Capabilities

- `producer-pack-archive`: Pack / install-from-archive extract MUST apply the shared safe-extract policy (not path-only checks).
- `registry-resolve-install`: Registry materialize MUST apply the same policy after lk-013 digest verify; MUST NOT leave successful partial trees.
- `manifest-yaml-validate`: Allow `registries.*.insecure`; enforce parse-time http:// gate with loopback/RFC1918 exemption and registry-named diagnostics.
- `openapm-conformance-statement`: Activate `req-sc-002` + `req-sc-006` with Mode B citations; refresh sc-004 skipped rationale; keep remaining deferred sc-* skipped; preserve active 001/007/009.
- `docs-openapm-boundary`: Align guide/Limitations wording with soft zip container + caps-present honesty (sc-004 still soft; §10.3 still deferred).

## Impact

- `@bapm/core`: Pack extract, Registry `materializeRegistryArchive`, shared archive helper; Manifest `validateRegistries` / RegistryEntry typing.
- Mode B: `tests/spec-conformance/checklist.yml` → `conformance:gen` / `conformance:check`; Limitations / Scope-out soft §10.
- Docs: conformance guide residual security wording if Limitations change.
- Tests: unit + acceptance under `**/sc-soft-security/`; Mode B citation paths for sc-002/sc-006.
- Does **not** touch AuthResolver, approve UX, or registry wire format migration.
