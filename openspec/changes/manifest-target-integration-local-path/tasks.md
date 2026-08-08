## 1. Loader path classification and containment

- [x] 1.1 Add path-vs-npm heuristic (`./`, `../`, absolute) in CLI `loadManifestIntegrations` (or small helper beside it)
- [x] 1.2 Enforce lexical project-root containment for path-classified values (reuse Core `resolveLocalPath` if FEOD-clean, else duplicate lexical check); fail-closed with clear diagnostic before import
- [x] 1.3 Resolve path-classified values via existing `createRequire(join(cwd, "package.json")).resolve` + `import(pathToFileURL)` only (no CLI fallback resolve for paths); keep npm path unchanged including CLI fallback

## 2. Tests

- [x] 2.1 Unit tests: in-root relative directory loads; explicit `.js` file loads; missing path fails; `../` escape fails; absolute outside root fails; bare/`@scope` npm strings still load
- [x] 2.2 Wire install/compile path coverage as needed so `--target` with local map binding succeeds end-to-end in CLI tests (or leave RED acceptance to orch-acceptance)

## 3. Docs

- [x] 3.1 Update `apps/docs/guide/config-manifest.md` object-map section: npm **or** local path examples, Node directory resolution, project-root containment
- [x] 3.2 Update `apps/docs/architecture/index.md` author how-to with a local-path example (`./agents/integration/…`)
