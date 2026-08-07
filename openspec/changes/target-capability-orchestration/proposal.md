## Why

Core still contains target-specific compile, deployed-file attribution, and exclude validation decisions. Those decisions must instead be derived from registered target packages and their automatically detected capabilities.

## What Changes

- Add registry-driven active-target detection: use the sole detected target automatically; require explicit `--target <id>` when zero or multiple targets are detected.
- Add target capabilities for compile output and deployed-file attribution, removing Cursor layout knowledge from core.
- Validate install exclusions against registered targets rather than a Cursor allowlist.
- Move CLI target registration and init detection into a composition-root integration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `target-api-contracts`: add generic detection, compile, and deployment-attribution contracts.
- `install-pipeline`: detect and validate targets through the registry, and consume target deployment metadata.
- `compile-agents-md`: select a target explicitly or from unambiguous automatic detection.
- `cli-runtime-surface`: expose explicit-target guidance for ambiguous or missing detection.
- `target-package-architecture`: require host layouts and output emitters to reside in target packages.

## Impact

- `packages/target-api`, `packages/target-cursor`, `packages/core`, and `packages/cli`
- Public target contracts and `bapm compile` target-selection behaviour
- No automatic fallback when target detection is ambiguous
