## Why

Eleven host packages repeat the same deploy-write, compile markdown, and command frontmatter filtering. `@b-apm/integration-api` already owns shared skill/materialize helpers; extending that surface removes the next copy-paste clusters without inventing a mega host factory.

## What Changes

- Add `writeDeployedFile`, `renderPrimitivesMarkdown`, `compileMarkdownReport`, and `filterFrontmatterKeys` to `@b-apm/integration-api` (exported from package root).
- Unit-test the helpers in `packages/integration-api`.
- Migrate host integrations that duplicate these patterns to call the shared helpers (behavior-preserving).
- Update `packages/integration-api/README.md` helper table.
- **Non-goals:** ownership sidecars, `copyHookScript`, MCP normalize/merge, `createMaterializeSession`, layout/detect abstraction, TOML helpers.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `integration-api-contracts`: ADDED requirements for optional shared helpers (`writeDeployedFile`, compile markdown helpers, `filterFrontmatterKeys`, host-neutral frontmatter allowlist constant). Registry / `BapmIntegration` contracts unchanged.

## Impact

- Package: `@b-apm/integration-api` (+ tests, README)
- Consumers: `@b-apm/integration-*` hosts that used the duplicated patterns
- No core Install/Compile contract changes; diagnostic codes remain host-prefixed at call sites
