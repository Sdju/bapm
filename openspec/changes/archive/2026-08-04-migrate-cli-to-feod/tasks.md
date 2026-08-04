## 1. Tooling and layer scaffold

- [x] 1.1 Add `@/*` → `./src/*` path mapping in `packages/cli/tsconfig.json`
- [x] 1.2 Create FEOD directories under `packages/cli/src`: `app/` (with `init/`, `integrations/`), `commands/`, `modules/`, `common/`, `globals/`
- [x] 1.3 If `vp pack` / tests fail to resolve `@/`, add matching `resolve.alias` in `packages/cli/vite.config.ts`

## 2. Integrations and soft IoC

- [x] 2.1 Add `app/integrations` wrapper over `@bapm/core` (name, version getter, manifest/lock file constants) — no `@bapm/core` imports outside app integrations / init wiring
- [x] 2.2 Implement `modules/Help` (directory + `index.ts` public API) with help text logic moved from `run.ts`
- [x] 2.3 Implement `modules/Version` (directory + `index.ts`) using injected core name/version deps
- [x] 2.4 Implement `modules/Install` (directory + `index.ts`) with `createInstall(deps?)` soft IoC and install-stub behavior equivalent to current `run.ts`
- [x] 2.5 Wire factories in `app/init/` using integrations; export ready instances for registry/commands
- [x] 2.6 Add `common/constants/commands.ts` (or equivalent concrete file, no `common/index.ts`) for shared command name tokens if needed

## 3. Commands, registry, and public entry

- [x] 3.1 Add thin handlers `commands/help.ts`, `commands/version.ts`, `commands/install.ts` (argv → module API → exit code only)
- [x] 3.2 Add manual `app/registry.ts` mapping `help` / `version` / `install` and flag aliases (`-h`, `--help`, `-V`, `--version`)
- [x] 3.3 Implement `runCli` in `app/run.ts` (default help, unknown command → error + help + exit 1) using the registry
- [x] 3.4 Point `src/cli.ts` and `src/index.ts` at `runCli`; remove obsolete flat `src/run.ts`
- [x] 3.5 Confirm pack entries remain `src/index.ts` and `src/cli.ts` in `vite.config.ts` / package `bin` + `exports`

## 4. Verify

- [x] 4.1 Update any broken relative imports in `packages/cli/tests` if needed (still consume `runCli` from package entry)
- [x] 4.2 Run `vp check` in `packages/cli` and fix type/lint issues from the move
- [x] 4.3 Run `vp test` in `packages/cli` — existing version test and any new acceptance tests must pass
- [x] 4.4 Run `vp pack` (or `vp run build`) in `packages/cli` and confirm `dist` entries build
- [x] 4.5 FEOD checklist: no deep module imports, no `common/index.ts`, no single-file modules, no `@bapm/core` in `commands/`, commands stay thin
