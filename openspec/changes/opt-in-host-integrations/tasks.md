## 1. CLI composition root — runtime registry

- [ ] 1.1 Change `createCliIntegrationRegistry` to return an empty registry (remove `@bapm/integration-cursor` static import/register)
- [ ] 1.2 Remove `@bapm/integration-cursor`, `@bapm/integration-claude`, `@bapm/integration-codex` from `@bapm/cli` dependencies via pnpm/vp catalog tooling (keep `@bapm/integration-api`); ensure workspace install still links integrations for packages that need them
- [ ] 1.3 Adjust unknown-target / map-load diagnostics to drop “built-in” framing and hint at installing the package + object-map `targets:`

## 2. Marketplace outputs — on-demand load

- [ ] 2.1 Change `createCliMarketplaceOutputRegistry` to start empty (remove static Claude/Codex imports)
- [ ] 2.2 Before pack marketplace emit, dynamically resolve/register `@bapm/integration-claude` / `@bapm/integration-codex` when those formats are selected; fail closed with install guidance if unresolved
- [ ] 2.3 Update pack CLI tests (`pack-marketplace-filter` and related) so fixtures resolve marketplace packages without relying on CLI hard deps

## 3. Init template UX

- [ ] 3.1 When `bapm init` records `--target <id>` for the Cursor example (and other `@bapm/integration-<id>` convention ids as designed), emit object-map `targets: { <id>: "@bapm/integration-<id>" }` plus `active: [<id>]` instead of string-only `target:`
- [ ] 3.2 Update init-related tests/fixtures to expect the object-map shape

## 4. Docs and README

- [ ] 4.1 Update root `README.md`: CLI install + separate Cursor package example; remove “уже встроен в CLI” / “из коробки”
- [ ] 4.2 Update `apps/docs/guide/supported-hosts.md`, `quick-start.md`, `manifest-hosts.md`, `guide/index.md` (and any situations that claim built-in Cursor) to the opt-in package + `targets:` UX
- [ ] 4.3 Ensure docs-boundary / config-manifest tests still pass after wording changes (no false “built-in” claims)

## 5. Test suite alignment

- [ ] 5.1 Invert/remove CLI test “built-in cursor works without a map entry”; add coverage that `--target cursor` without map fails closed
- [ ] 5.2 Update install/compile/MCP/map-load fixtures that assumed built-in Cursor to declare object-map + resolvable `@bapm/integration-cursor` (devDependency or fixture resolve), without re-adding CLI hard dep
- [ ] 5.3 Run `vp check` / targeted `vp test` for `packages/cli` (and affected core docs tests); fix remaining “built-in” assumptions

## 6. Verification

- [ ] 6.1 Confirm fail-closed selection order unchanged: `--target` → `active` → sole detect → fail; map alone does not activate
- [ ] 6.2 Confirm `@bapm/cli` package.json has no hard deps on concrete `@bapm/integration-cursor|claude|codex`
