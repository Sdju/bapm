## 1. Manifest emit + mf-005 harden

- [x] 1.1 Add `createMinimalManifest` (name, semver default `0.1.0`, empty deps lists, no `workspaces`) on Manifest public API
- [x] 1.2 Harden validate-before-write: producer write path runs parse/validate before durable emit; preserve vendor `x-*`; mf-004 non-blocking warn on non-semver
- [x] 1.3 Enforce mf-005 target/targets token rules (canonical/alias set + `x-<vendor>-<name>`); reject invalid tokens with named diagnostic
- [x] 1.4 Re-export new Manifest symbols from `app/publicApi` / package entry without breaking existing exports

## 2. Core Pack module (zip + secrets)

- [x] 2.1 Add zip library to pnpm catalog via CLI (pnpm-dependencies skill); wire into `@b-apm/core` only through Pack adapters
- [x] 2.2 Add `modules/Pack` (directory + `index.ts`): collect pack set (manifest, optional lock/primitives); default excludes (`.git`, `node_modules`, prior artifacts)
- [x] 2.3 Implement sc-007 secret-pattern refuse (`.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`); fail closed before durable zip finalize
- [x] 2.4 Implement `runPack` plain-zip create (`--archive`); validate manifest first; `--dry-run` leaves no durable artifact
- [x] 2.5 Implement `extractPackArchive` helper for install-from-archive round-trip

## 3. Core release gate (pr-004 / pr-005)

- [x] 3.1 Implement `checkReleaseTag` in Pack: strip optional `v`; compare to manifest `version`; semver+`v?` regex fail-closed
- [x] 3.2 Resolve tag from `--tag` or HEAD; fail closed if no tag; never create/push tags
- [x] 3.3 pr-005: warn on unsigned tag when detectable; never fail solely for unsigned
- [x] 3.4 Export Pack / release-check public APIs from package entry

## 4. Install-from-archive

- [x] 4.1 Extend Install to detect local `.zip` path argument and extract via Pack helper into project root
- [x] 4.2 After extract, dual-read parse landed manifest; fail closed on bad layout; continue existing install orchestration when deps present
- [x] 4.3 Document archive-path behavior in Install module README / public types as needed

## 5. CLI FEOD surface (init + pack)

- [x] 5.1 Add command constants and thin `commands/init.ts`, `commands/pack.ts` handlers
- [x] 5.2 Add `modules/Init/` and `modules/Pack/` + `app/init/` soft IoC; register in `app/registry.ts`; core only via integrations
- [x] 5.3 `init -y`: write `bapm.yml`; refuse if `apm.yml` or `bapm.yml` exists; cursor-thin `--target` / `.cursor/` detect; no plugin scaffold
- [x] 5.4 `pack`: `--archive`, `--dry-run`, `--check-release`, optional `--tag`; unknown flags hard-error
- [x] 5.5 Update help to list `init` and `pack`; mention install-from-archive on install help

## 6. Package graph + verification (apply only)

- [x] 6.1 Confirm workspace still has only `bapm-target-api` + `bapm-target-cursor` among `bapm-target-*`; no new target package; no core→cursor hard dep
- [x] 6.2 Keep M1–M6 consumer regressions green (install/lock/update/audit/cursor)
- [x] 6.3 Run build/test/`vp check` for `@b-apm/core` and `bapm`; fix in-scope regressions
- [x] 6.4 Spot-check: init→pack zip→install archive round-trip; pack refuses `.env`; `--check-release` align/mismatch/bad-tag
