## Why

Product messaging and docs claim Cursor (and effectively host integrations) ship “из коробки” because the CLI composition root eagerly registers `@bapm/integration-cursor` (and statically wires Claude/Codex marketplace outputs). That couples the CLI distribution to concrete hosts, contradicts the integration-package model (CLI + host package as separate installs), and makes custom hosts a second-class path. Integrations must be opt-in packages registered only when the user installs and declares them—not auto-registered at CLI startup.

## What Changes

- **BREAKING:** Remove eager built-in registration of Cursor from the CLI composition root (`createCliIntegrationRegistry`). The runtime registry starts empty; hosts appear only after successful object-map `target` / `targets` load (or an equivalent documented load path). `--target cursor` alone with legacy string `target: cursor` and no map binding MUST fail closed once Cursor is no longer built-in.
- **BREAKING:** Drop hard runtime dependencies of `@bapm/cli` on `@bapm/integration-cursor`, `@bapm/integration-claude`, and `@bapm/integration-codex`. CLI keeps `@bapm/integration-api` only; concrete packages are installed independently (global or project) and resolved via Node from project cwd (and existing CLI-adjacent resolve fallback when the package is present next to the CLI).
- **BREAKING:** Stop statically registering Claude/Codex in `createCliMarketplaceOutputRegistry`. Marketplace-output integrations load on demand when pack selects those formats and the corresponding packages resolve; missing package → fail-closed with install guidance.
- Documented UX: install `@bapm/cli` and `@bapm/integration-cursor` separately; declare `targets: { cursor: "@bapm/integration-cursor" }` (plus `active` / `--target` as today). Cursor is an example package, not “already inside CLI.”
- Update user docs (README, guide/supported-hosts, quick-start, manifest-hosts, guide index, related situations) so they no longer say “из коробки” / built-in for Cursor or imply Claude/Codex are bundled into the CLI binary.
- Preserve fail-closed active-host selection order: `--target` → `active` → sole detect → fail. Map still does not activate by itself.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `target-integration-dynamic-load`: Remove “built-in cursor without map” requirement; registry is map-driven (empty until map load); fail-closed diagnostics no longer refer to built-ins as the primary registration path.
- `integration-package-architecture`: Composition root MUST NOT eagerly register concrete host packages as a distribution built-in; registration happens via declared load (object-map / on-demand marketplace load).
- `cli-runtime-surface`: Install/compile help and behavior MUST NOT claim built-in Cursor; map load is required for host registration; wording about “built-in + map” → “map (and on-demand marketplace) registration only.”
- `install-pipeline`: Active-host selection wording drops “after built-in registration”; selection still runs after successful registration sources for the run.
- `manifest-active-targets`: Same wording shift—`active` ids must be registered via map load (not built-in).
- `marketplace-pack-outputs`: Claude/Codex outputs remain owned by their packages, but CLI MUST NOT statically register them at composition-root construction; load when format is selected and package resolves.

## Impact

- `packages/cli`: `app/integrations/registry.ts`, `marketplaceOutputs.ts`, `package.json` deps; install/compile/pack composition paths; CLI tests that assume built-in Cursor or static Claude/Codex.
- `apps/docs` + root `README.md`: install story CLI ≠ host integration.
- OpenSpec live requirements above; core selection logic largely unchanged once the registry is populated.
- Non-goals: changing `--target` / `active` / detect priority; inventing a new marketplace manifest map grammar in this change (on-demand package resolve by format id is enough); network-install of integration packages during load; merging integration packages into the CLI tarball; APM adapter-catalog parity.
