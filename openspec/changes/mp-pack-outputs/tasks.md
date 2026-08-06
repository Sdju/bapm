## 1. Core resolve + profiles (G1–G2)

- [ ] 1.1 Add Marketplace fractal builder types (`ResolvedPackage`, build options/report) under `packages/core` Marketplace; export via module + package façade
- [ ] 1.2 Implement package resolve from authoring config → `ResolvedPackage[]` (local `./` pass-through; github `owner/repo` via injectable thin `ls-remote`; honor `ref` / `version` + `build.tagPattern` / entry `tag_pattern`)
- [ ] 1.3 Fail-closed resolve UX for unresolvable remotes, non-github without hosts-auth, and `--offline` missing refs (no silent empty plugins; no reuse of stale on-disk JSON as success)
- [ ] 1.4 Implement output profile selection + `resolveEffectiveOutputPath` (defaults Claude/Codex, `outputs.*.path`, CLI overrides, path jail under project root)

## 2. Mappers + atomic write (G3–G4)

- [ ] 2.1 Implement Claude mapper → Anthropic-shaped JSON (`plugins[]`, strip APM-only fields, remote source objects + local path string; indent 2 + trailing newline)
- [ ] 2.2 Implement Codex mapper → Codex-shaped JSON (`interface.displayName`, `policy`, required `category`; missing category fails closed before write)
- [ ] 2.3 Implement multi-output loop: filter by `outputs` + `--marketplace` (`all`/`none`/list); unknown format hard-error; single resolve then per-profile atomic write; create parents
- [ ] 2.4 Implement `--dry-run` for marketplace paths (report would-write; no durable marketplace.json)

## 3. Pack orchestration + CLI (G5, G7)

- [ ] 3.1 Extend Pack core orchestration: when authoring present and outputs selected, call builder; zip+JSON when packable; marketplace-only skip empty zip (design D2)
- [ ] 3.2 Preserve plain-zip path, sc-007 refuse, and `--check-release` / `--tag` without regression
- [ ] 3.3 FEOD Pack CLI: parse `--marketplace`, `--marketplace-path FORMAT=PATH` (repeatable), marketplace-aware `--offline`; unknown flags still fail-closed
- [ ] 3.4 Update Pack help for marketplace mode; remove Authoring “pack host outputs not shipped”; do not register `marketplace build`
- [ ] 3.5 Wire soft IoC / integrations for builder APIs; no direct `@bapm/core` imports from `commands/`

## 4. Unit tests (G1–G4, G7)

- [ ] 4.1 Unit tests for resolve (local / mocked ls-remote / offline fail / tag pattern) under `**/mp-pack-outputs/`
- [ ] 4.2 Unit tests for path jail + profile defaults/overrides under `**/mp-pack-outputs/`
- [ ] 4.3 Unit tests for Claude/Codex mappers (happy path shapes; Codex missing category fails) under `**/mp-pack-outputs/`
- [ ] 4.4 Unit tests for dry-run / `--marketplace none` / unknown format under `**/mp-pack-outputs/`

## 5. Acceptance (G6) + guardrails

- [ ] 5.1 Acceptance `**/mp-pack-outputs/`: authoring fixture with local packages → `bapm pack` writes Claude JSON; optional Codex+category case; `--marketplace none` skips JSON
- [ ] 5.2 Acceptance: packable project with marketplace → zip still produced + JSON written; dry-run leaves neither durable zip nor JSON
- [ ] 5.3 Acceptance: marketplace-only project emits JSON and does not require empty zip
- [ ] 5.4 Confirm no CONFORMANCE.md / claim-table / `req-sc-*` edits; no AuthResolver matrix

## 6. Optional SHOULD (defer if XL)

- [ ] 6.1 Optionally wire `--include-prerelease` into range resolve if cheap
- [ ] 6.2 Leave `--check-versions` / `--check-clean` / `--json` envelope for follow-up (document skip in PR notes if deferred)
