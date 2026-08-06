## 1. Shared safe-extract (G1–G6)

- [ ] 1.1 Add shared archive-safe helper (Pack-adjacent or twin): zip CD / ZipInfo pre-scan for names, uncompressed sizes, unix mode / external_attr symlink bit (`0xA000`); reject `..`, absolute, symlink, and non-regular when detectable (G1, G2)
- [ ] 1.2 Enforce default caps: max **10 000** file entries and **100 MB** uncompressed; fail closed on exceed (G4, G5)
- [ ] 1.3 Implement fail-closed cleanup: staging+rename or rmtree partial dest on first bad entry / I/O / cap error (G3)
- [ ] 1.4 Wire Pack `extractPackArchive` through the shared helper (replace path-only checks) (G6)
- [ ] 1.5 Wire Registry `materializeRegistryArchive` through the same helper **after** `verifyArchiveDigest` (lk-013 unchanged) (G6)

## 2. Registries insecure + http gate (G7–G8)

- [ ] 2.1 Allow `insecure` boolean on registry objects; keep mf-015 unknown-key reject except `url` / `aliases` / `insecure` / `x-*`; type `RegistryEntry` (G7)
- [ ] 2.2 Add `isExemptInsecureHost` (loopback / `localhost` / `::1` / RFC1918); parse-time `http://` gate; diagnostics MUST name the registry; string-form remote http fails without exemption (G8)

## 3. Acceptance + Mode B claims (G9–G10)

- [ ] 3.1 Acceptance under `**/sc-soft-security/`: symlink reject, path-escape, cleanup, entry/size caps on Pack and Registry paths; insecure allow + remote http deny + loopback exempt + named diagnostic
- [ ] 3.2 Flip checklist `req-sc-002` + `req-sc-006` → `active` with citations only after GREEN coverage; refresh `req-sc-004` skipped rationale (caps on zip; container soft); leave 003/005/008/010–013 skipped; leave 001/007/009 active (G9)
- [ ] 3.3 Update checklist Limitations / soft §10 for zip caps + deferred §10.3; run `conformance:gen` + `conformance:check`; align docs guide residual wording (G10)
- [ ] 3.4 Guard test: no false actives for deferred sc-*; sc-002/006 citations resolve on disk

## 4. Verification

- [ ] 4.1 Unit tests for helper (symlink zip fixture, caps, cleanup) and `validateRegistries` insecure matrix
- [ ] 4.2 Confirm digest mismatch still skips extract; no sc-004/003/005/008/010–013 claim churn
- [ ] 4.3 `openspec validate sc-soft-security --strict` remains green after apply edits to artifacts if any
