## 1. CLI composition root — runtime registry

- [x] 1.1 Change `createCliIntegrationRegistry` to return an empty registry (remove `@b-apm/integration-cursor` static import/register)
- [x] 1.2 Remove `@b-apm/integration-cursor`, `@b-apm/integration-claude`, `@b-apm/integration-codex` from `@b-apm/cli` dependencies via pnpm/vp catalog tooling (keep `@b-apm/integration-api`); ensure workspace install still links integrations for packages that need them
- [x] 1.3 Adjust unknown-target / map-load diagnostics to drop “built-in” framing and hint at installing the package + object-map `targets:`

## 2. Marketplace outputs — on-demand load

- [x] 2.1 Change `createCliMarketplaceOutputRegistry` to start empty (remove static Claude/Codex imports)
- [x] 2.2 Before pack marketplace emit, dynamically resolve/register `@b-apm/integration-claude` / `@b-apm/integration-codex` when those formats are selected; fail closed with install guidance if unresolved
- [x] 2.3 Update pack CLI tests (`pack-marketplace-filter` and related) so fixtures resolve marketplace packages without relying on CLI hard deps

## 3. Init template UX

- [x] 3.1 When `bapm init` records `--target <id>` for the Cursor example (and other `@b-apm/integration-<id>` convention ids as designed), emit object-map `targets: { <id>: "@b-apm/integration-<id>" }` plus `active: [<id>]` instead of string-only `target:`
- [x] 3.2 Update init-related tests/fixtures to expect the object-map shape

## 4. Docs and README

- [x] 4.1 Update root `README.md`: CLI install + separate Cursor package example; remove “уже встроен в CLI” / “из коробки”
- [x] 4.2 Update `apps/docs/guide/supported-hosts.md`, `quick-start.md`, `manifest-hosts.md`, `guide/index.md` (and any situations that claim built-in Cursor) to the opt-in package + `targets:` UX
- [x] 4.3 Ensure docs-boundary / config-manifest tests still pass after wording changes (no false “built-in” claims)

## 5. Test suite alignment

- [x] 5.1 Invert/remove CLI test “built-in cursor works without a map entry”; add coverage that `--target cursor` without map fails closed
- [x] 5.2 Update install/compile/MCP/map-load fixtures that assumed built-in Cursor to declare object-map + resolvable `@b-apm/integration-cursor` (devDependency or fixture resolve), without re-adding CLI hard dep
- [x] 5.3 Run `vp check` / targeted `vp test` for `packages/cli` (and affected core docs tests); fix remaining “built-in” assumptions

## 6. Verification

- [x] 6.1 Confirm fail-closed selection order unchanged: `--target` → `active` → sole detect → fail; map alone does not activate
- [x] 6.2 Confirm `@b-apm/cli` package.json has no hard deps on concrete `@b-apm/integration-cursor|claude|codex`
