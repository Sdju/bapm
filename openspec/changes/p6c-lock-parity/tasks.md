## 1. Core Export module

- [ ] 1.1 Create FEOD module `packages/core/src/modules/Export/` (`index.ts`, types, README) with public surface for SBOM export
- [ ] 1.2 Implement `scrubUrl` + `buildPurl` from lock dependency fields (git forge / oci / generic / local) aligned with APM inventory rules
- [ ] 1.3 Implement CycloneDX 1.5 serializer (components sorted by purl, license three-state omit/passthrough, scrubbed distribution refs, bapm tool metadata)
- [ ] 1.4 Implement SPDX 2.3 serializer (same inventory inputs; undeclared → `NOASSERTION`; lazy-load heavy SPDX id tables if needed)
- [ ] 1.5 Implement `exportSbom` / load-from-cwd helper: format validation fail-closed; timestamp order `--timestamp` > `SOURCE_DATE_EPOCH` > `generated_at` > fixed epoch; stable JSON (indent + sorted keys); skip synthetic self; missing lock → failure
- [ ] 1.6 Re-export Export public API from `packages/core/src/app/publicApi.ts` (and package entry)

## 2. Lock rewrite inventory carry

- [ ] 2.1 Update `buildLockDocument` in Resolver to opaque-carry `mcp_*`, `lsp_*`, `deployments`, and other existing unknown/`x-*` top-level bags from `existing` (keep deployed hash carries; keep lk-015 `tree_sha256`)
- [ ] 2.2 Add/adjust core unit coverage: lock rewrite preserves `mcp_*`; absent MCP not invented; tree_sha256 still present for git

## 3. CLI lock group + flags

- [ ] 3.1 Route `lock export` in CLI Lock module (parse `-f`/`--format`, `-o`/`--output`, `--timestamp`; fail-closed unknown export args/format)
- [ ] 3.2 Wire export IO purity (SBOM stdout or `-o` file; diagnostics/`-o` success on stderr; missing lock non-zero + empty stdout); call core Export only (no resolveAndLock)
- [ ] 3.3 Accept `--parallel-downloads 0` on bare lock (= serial); update lock help for export + parallel `0`
- [ ] 3.4 Keep bare lock no-deploy / policy flags behavior unchanged

## 4. Verification

- [ ] 4.1 Unit tests: purl/scrub, CycloneDX/SPDX smoke, deterministic double-export with pinned timestamp, carry-forward bags
- [ ] 4.2 CLI/unit tests: export formats, missing lock IO, parallel `0` accepted, harness untouched on export path (as cheap)
- [ ] 4.3 Run targeted `vp`/vitest for touched packages; fix regressions in existing lock tests
