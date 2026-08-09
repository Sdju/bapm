## Why

After `integration-api-shared-helpers` landed deploy/compile/frontmatter helpers, host packages still duplicate hook ownership sidecars, entry stripping, artifact removal, and simple script copy. Centralizing that next cluster in `@bapm/integration-api` cuts copy-paste without inventing a full hooks materialize factory.

## What Changes

- Add shared hook ownership helpers to `@bapm/integration-api`: `readHookOwnershipSidecar` / `writeHookOwnershipSidecar`, type `HookOwnershipSidecar` (flexible owned records: `entries?`, `scripts?`, `hookFile?`, `hookFiles?`), `stripOwnedHookCommands`, `removeOwnedHookArtifacts`, and simple `copyHookScript` for the six merge/copy hosts that share the same candidate resolution.
- Unit-test the helpers in `packages/integration-api`.
- Migrate matching hosts (behavior-preserving): merge hosts first for sidecar + strip (+ script rm only where already present); copilot/kiro/antigravity for ownership read/write/remove; simple `copyHookScript` where the host already matches the shared signature.
- Update `packages/integration-api/README.md` helper table.
- **Non-goals:** full `materialize*Hooks` factory; MCP normalize/merge; thick copy rewrite for antigravity/kiro (unless a thin shared resolve later); event remap; host-specific hook JSON transforms. Do **not** silently add script `rm` to cursor/claude (or other strip-only hosts) if they currently only strip entries.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `integration-api-contracts`: ADDED requirements for optional shared hook ownership / copy helpers (`HookOwnershipSidecar`, read/write sidecar, strip owned commands, remove owned artifacts, simple `copyHookScript`). Registry / `BapmIntegration` contracts unchanged.

## Impact

- Package: `@bapm/integration-api` (+ tests, README)
- Consumers: `@bapm/integration-{cursor,claude,windsurf,gemini,codex,copilot,kiro,antigravity}` where patterns match
- No core Install/Compile contract changes; diagnostic codes remain host-prefixed at call sites
