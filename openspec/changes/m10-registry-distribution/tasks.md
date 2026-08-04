## 1. Core Registry HTTP client

- [ ] 1.1 Add `@bapm/core` directory module `Registry` (FEOD): injectable HTTP transport port; default real fetch
- [ ] 1.2 Implement list versions `GET /v1/packages/{owner}/{repo}/versions` with JSON parse, ~10 MiB cap, fail-closed diagnostics
- [ ] 1.3 Implement download `GET …/versions/{version}/download` returning archive bytes/stream handle
- [ ] 1.4 Implement publish PUT `…/versions/{version}` with zip body; map 401/403/409/422 to actionable errors
- [ ] 1.5 Wire Bearer auth from `BAPM_REGISTRY_TOKEN` (+ optional per-registry `BAPM_REGISTRY_<NAME>_TOKEN`); anonymous GET when unset
- [ ] 1.6 Export Registry public API via `app/publicApi` / package entry; unit tests with mock transport

## 2. Experimental gate

- [ ] 2.1 Implement opt-in gate (`BAPM_EXPERIMENTAL_REGISTRIES=1` and/or documented CLI flag) shared by registry resolve/install and `publish`
- [ ] 2.2 When gate off: registry deps and publish fail closed with remediation naming how to enable; help documents gate

## 3. Registry resolve + install (close DEFERRED)

- [ ] 3.1 Replace `RESOLVE_REGISTRY_DEFERRED` with Registry list → semver/exact pick → download path for supported registry entries
- [ ] 3.2 Resolve `registries:` / `registries.default` and per-dep `registry:` name routing; missing config fail closed
- [ ] 3.3 lk-013: SHA-256 verify advertised digest **before** extract; mismatch → non-zero, no partial extract
- [ ] 3.4 Populate lock `source: registry`, `resolved_url`, `resolved_hash` (`sha256:<hex>`); force `lockfile_version: "2"`
- [ ] 3.5 rs-009: allow mirror URL on replay iff bytes match `resolved_hash`; mismatch fail closed
- [ ] 3.6 MUST NOT silent git fallback; marketplace kind remains deferred/fail-closed
- [ ] 3.7 Wire install materialize after M8 policy gate; policy deny still aborts before modules writes
- [ ] 3.8 Keep git/local-only resolve/install behavior unchanged

## 4. Thin publish (flat zip + PUT)

- [ ] 4.1 Core flat publish-archive builder: emit `apm.yml` at zip root (from dual-read load), `.apm/**`, optional root docs; reuse zip I/O helpers only—do not call M7 pack product API
- [ ] 4.2 Preflight: require `owner/repo` + version; dual-read xor; missing `.apm/` fail unless `--zip`
- [ ] 4.3 CLI FEOD: `commands/publish` + `Publish` module; `--dry-run` (no PUT), `--zip <path>`; hard-reject unknown flags
- [ ] 4.4 Surface 409 immutability / 422 / 401–403; gate required (task 2)
- [ ] 4.5 Confirm `pack` remains independent M7 command (no rewrite)

## 5. Thin self-update

- [ ] 5.1 Core self-update check helper: primary metadata source **npm** dist-tag (`latest` = stable; prerelease via documented tag/env); injectable metadata port
- [ ] 5.2 CLI FEOD: `commands/self-update` + module; `--check` messaging + exit policy (0 up-to-date; non-zero when update available or check failed)
- [ ] 5.3 Unknown / `0.0.0` version: warn/skip, never claim latest
- [ ] 5.4 Help documents `--check` and upgrade path `npm i -g bapm@…` (or documented package name)
- [ ] 5.5 SHOULD: `self-update` without `--check` runs one upgrade path (npm global update / printed re-exec); optional packager kill-switch env

## 6. CLI surface + FEOD

- [ ] 6.1 Register `publish` and `self-update` in app registry; help lists both alongside existing commands
- [ ] 6.2 Thin handlers only; core via `app/integrations` / `app/init`; no business logic in `commands/`/`app/`
- [ ] 6.3 Hard-error unknown flags on new commands

## 7. Acceptance fixtures support (implementer / apply)

- [ ] 7.1 Provide mock HTTP registry fixture (local server or injectable transport) for list/download/PUT + controllable digests
- [ ] 7.2 Ensure conformance note: Consumer lk-013/rs-009 covered; OpenAPM Registry class **N/A** (no host claim)

## 8. Package graph + verification (apply only)

- [ ] 8.1 Confirm workspace still only `bapm-target-api` + `bapm-target-cursor` among `bapm-target-*`; prefer zero target edits; no core→cursor hard dep
- [ ] 8.2 Dual-read: apm.yml-only and bapm.yml-only work for resolve/install/publish preflight; both present → error
- [ ] 8.3 Regression: non-registry projects (M3–M9) green; pack unchanged; marketplace still deferred
- [ ] 8.4 Run build/test/`vp check` for `@bapm/core` and `bapm`; fix in-scope regressions
