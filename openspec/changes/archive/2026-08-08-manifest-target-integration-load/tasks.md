## 1. Loader and export contract

- [x] 1.1 Add CLI helper (under `packages/cli/src/app/integrations/`) to resolve a package specifier from project cwd, import the module, and extract a runtime `BapmIntegration` per design export precedence (`createIntegration` → default factory/object); reject marketplace-only and id-mismatch
- [x] 1.2 Implement `registerManifestIntegrations(registry, manifest, cwd)` that reads `declaredTargetIntegrationMap`, eagerly loads every entry, registers/replaces by map key, and throws fail-closed diagnostics naming id + specifier + cause class
- [x] 1.3 Unit-test the helper: valid factory, default-export object, unresolvable specifier, marketplace-only export, id mismatch

## 2. Wire install and compile composition roots

- [x] 2.1 Call map registration after `createCliIntegrationRegistry()` and before `coreRunInstall` in install service (load project manifest for map when present)
- [x] 2.2 Apply the same registration step on the compile CLI path before core compile
- [x] 2.3 Update stale comments on `declaredTargetIntegrationMap` / Install README that say map values MUST NOT load

## 3. Docs

- [x] 3.1 Update `apps/docs/guide/config-manifest.md`: object-map values load/register before selection; selection still `--target` → detect → fail; built-in cursor optional in map; remove absolute “не авто-загружаются”
- [x] 3.2 Update `apps/docs/architecture/index.md` (and a short author how-to subsection or linked guide): publish package, export contract, add as project npm dep, declare map, `bapm install --target <id>`; note Claude/Codex remain marketplace-output
- [x] 3.3 Document the loadable export contract in `@b-apm/integration-api` and/or `@b-apm/integration-cursor` README cross-link for third-party authors

## 4. Verification

- [x] 4.1 Add CLI fixture/tests: object-map + local resolvable mock integration package + `install --target x-acme-editor` succeeds registration path; unknown id still fails; broken specifier fails closed
- [x] 4.2 Ensure prior cursor `--target cursor` / detect paths and object-map key intersection tests remain green
- [x] 4.3 Run package checks for touched CLI/docs (and core if comments/helpers touched)
