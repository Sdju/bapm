## 1. Core plugin scaffold helpers (G2–G4)

- [ ] 1.1 Add `validatePluginName` (`^[a-z][a-z0-9-]{0,63}$`) and path-safe `validateProjectName` (reject `/`, `\`, `..`) under `packages/core` Manifest helpers; export via module `index.ts` + `app/publicApi`
- [ ] 1.2 Add `createPluginJson` / write helper: fields `name`, `version`, `description`, `author: { name }`, `license: "MIT"`; indent 2 + trailing newline
- [ ] 1.3 Extend `createMinimalManifest` (or sibling) with opt-in plugin mode: emit `devDependencies: { apm: [] }` while keeping consumer path unchanged; prefer `includes: auto` + `scripts: {}` when cheap
- [ ] 1.4 Unit tests for name validation + plugin.json + plugin-mode YAML writers (version `0.1.0` defaults)

## 2. FEOD CLI Plugin module (G1, G5)

- [ ] 2.1 Create `packages/cli/src/modules/Plugin/` (directory + `index.ts` public API + README); services for parse/help/`runPluginInit`; no module-local `commands/`
- [ ] 2.2 Thin `commands/plugin.ts` + `app/init/plugin.ts` + `COMMAND_PLUGIN` + registry wiring; core APIs only via integrations/injected deps
- [ ] 2.3 Implement `--yes`/`-y`, optional `PROJECT_NAME` subdir, `--target`, `-v`/`--verbose`; fail-closed unknown flags; overwrite with `--yes` only; refuse without; exit 0 on success; invalid name → ≠0 + clear error; no network
- [ ] 2.4 Success stdout next-steps mention `bapm pack` / install-dev style hints (text only); ensure thin scaffold creates neither `SKILL.md` nor empty `agents/`/`skills/`
- [ ] 2.5 Top-level Help lists `plugin`; `plugin --help` lists `init`

## 3. Verification (G6)

- [ ] 3.1 Satisfy acceptance suite under `tests/acceptance/mp-plugin-init/` once written by acceptance phase (apply until GREEN)
- [ ] 3.2 Confirm no CONFORMANCE.md / `req-sc-*` / authoring-yml / pack-output / consumer find-search-install churn; consumer `bapm init` still refuses overwrite
