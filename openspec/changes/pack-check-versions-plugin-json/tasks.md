## 1. Authoring strategy typing

- [ ] 1.1 Type `marketplace.versioning.strategy` (`lockstep` | `tag_pattern` | `per_package`, default `lockstep`) in Marketplace Authoring load/types; fail closed on unknown strategy
- [ ] 1.2 Unit tests: omit → lockstep; explicit `tag_pattern` retained; unknown strategy fails load

## 2. Core version-alignment gate

- [ ] 2.1 Implement local version reader: dual-read `bapm.yml`/`apm.yml` authoritative; else `plugin.json` via APM location order; 1 MiB cap; printable ASCII plugin versions; no fallback when preferred manifest present but invalid
- [ ] 2.2 Implement `checkVersionAlignment` (lockstep / tag_pattern / per_package) over local packages only; reuse existing tag-pattern renderer; ignore remotes; pure/no network
- [ ] 2.3 Export helper from `@b-apm/core` public API (distinct from `checkReleaseTag`)
- [ ] 2.4 Unit tests mirroring APM `TestLocalVersionSource`: plugin-only OK; manifest wins; invalid YAML no fallback; missing/malformed/non-file/oversized plugin.json fail; lockstep drift; per_package divergent OK

## 3. CLI pack wiring

- [ ] 3.1 Add `--check-versions` to `parsePackArgs`, help text, and `runPack` gate path (gate-only when no archive/marketplace-write intent; skip-with-info when no marketplace; fail closed on misalignment / bad marketplace load)
- [ ] 3.2 Ensure `--check-release` / `--archive` / marketplace emit / `--agent-plugins` do not regress; gate-only run leaves no durable zip
- [ ] 3.3 CLI/pack smoke tests: help mentions both `--check-versions` and `--check-release`; plugin-only marketplace gate passes; missing plugin version fails; no-marketplace skip exits 0

## 4. Docs

- [ ] 4.1 Update `apps/docs/reference/pack.md` flag table + short note on plugin.json version fallback vs authoritative YAML
- [ ] 4.2 Spot-check pack help string matches docs wording (distinct from `--check-release`)

## 5. Verification

- [ ] 5.1 Run targeted vitest for marketplace authoring + version-check + pack CLI suites
- [ ] 5.2 `openspec validate pack-check-versions-plugin-json --strict` still passes after any task edits to change artifacts
