## 1. Shared hook helpers in integration-api

- [ ] 1.1 Add `HookOwnershipSidecar` type plus `readHookOwnershipSidecar` / `writeHookOwnershipSidecar` in `@bapm/integration-api` (export from package root)
- [ ] 1.2 Add `stripOwnedHookCommands` (filter event arrays by owned entry commands; no disk deletes)
- [ ] 1.3 Add `removeOwnedHookArtifacts` (best-effort rm of `scripts` + optional `hookFile` / `hookFiles` under cwd)
- [ ] 1.4 Add simple `copyHookScript({ cwd, deployRoots, hookFile, command, alreadyDeployedNeedle, destRel, commandAsDotSlash? })`
- [ ] 1.5 Export new symbols from `packages/integration-api/src/index.ts` and document them in `packages/integration-api/README.md` helpers table

## 2. Unit tests

- [ ] 2.1 Tests for sidecar read (missing / malformed → empty owned) and write round-trip with mixed optional fields
- [ ] 2.2 Tests for `stripOwnedHookCommands` (owned removed, unrelated kept, empty ownership no-op)
- [ ] 2.3 Tests for `removeOwnedHookArtifacts` (deletes listed paths; missing paths ignored; does not throw)
- [ ] 2.4 Tests for simple `copyHookScript` (copy + rewrite, already-deployed needle skip, missing source keeps command, deploy-root refusal)

## 3. Host migration (behavior-preserving)

- [ ] 3.1 Migrate merge hosts cursor/claude/gemini/codex: sidecar read/write + `stripOwnedHookCommands` + simple `copyHookScript`; do **not** add script/artifact rm
- [ ] 3.2 Migrate windsurf: strip + `removeOwnedHookArtifacts` (scripts) + simple `copyHookScript` (same composition as today)
- [ ] 3.3 Migrate copilot: sidecar + `removeOwnedHookArtifacts` + simple `copyHookScript`
- [ ] 3.4 Migrate kiro/antigravity: sidecar read/write + `removeOwnedHookArtifacts` (or script-only cleanup for agy); keep local thick `copyHookScript`
- [ ] 3.5 Run affected host hook tests + `packages/integration-api` tests; fix any regressions without expanding cleanup scope

## 4. Deferred (explicit non-goals)

- [ ] 4.1 Confirm out of scope remains deferred: full materialize*Hooks factory, MCP normalize/merge, agy/kiro thick copy rewrite, event remap, host transforms
