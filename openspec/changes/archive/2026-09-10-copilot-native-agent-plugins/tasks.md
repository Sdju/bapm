## 1. Registrar core

- [x] 1.1 Add a core helper (Install or AgentPlugins-adjacent) that builds/rebuilds `apm_modules/.github/plugin/marketplace.json` and `apm_modules/.github/plugin/apm-registration.json` from an admitted portable plugin set (repo-relative paths under `apm_modules/`)
- [x] 1.2 Implement merge into `.github/copilot/settings.local.json` for `extraKnownMarketplaces.apm` (directory `apm_modules`) and `enabledPlugins["<name>@apm"]`, preserving unrelated keys; fail closed on invalid JSON; re-adopt matching marketplace; refuse conflicting unowned `apm` marketplace path
- [x] 1.3 Implement admission + collision rules (valid portable root, direct over transitive, same-precedence fail) and rebuild/retire helpers usable from uninstall/prune when the admitted set shrinks or becomes empty

## 2. Install orchestration

- [x] 2.1 Hook native registration into install when effective targets include `copilot`; skip writes on dry-run; fail closed before successful lock commit on registration errors
- [x] 2.2 Omit loose Copilot skill/MCP (whole-plugin) primitive projection for package roots admitted to native registration while leaving other targets’ portable projections intact
- [x] 2.3 Ensure registration never invokes or version-checks a Copilot binary

## 3. Copilot integration skip path

- [x] 3.1 Teach `@b-apm/integration-copilot` materialize (via install-supplied signal/metadata, no core→integration hard dep) to skip loose `.agents/skills/` (and portable MCP configure from that root) for admitted native-registered packages
- [x] 3.2 Keep ordinary non-plugin Copilot skill/instruction/prompt/agent/hook materialize unchanged

## 4. Lifecycle

- [x] 4.1 On uninstall/prune of natively registered plugins, rebuild or clear owned catalog/ledger and retire owned `@apm` enable keys; delete empty generated catalog artifacts; honor dry-run

## 5. Docs and compatibility matrix

- [x] 5.1 Document Copilot-native registration in `apps/docs/guide/agent-plugins.md` (and host notes as needed): `apm_modules` layout, settings keys, no copy/`--plugin-dir`, Copilot CLI ≥1.0.81, folder trust, `--agent-plugins` sufficient for authoring
- [x] 5.2 Add fixture-backed Copilot-native case to `tests/agent-plugins/compatibility-cases.json` / `AGENT_PLUGINS_COMPATIBILITY.md` and ensure `agent-plugins:check` passes

## 6. Verification (apply phase; acceptance owns RED suite)

- [x] 6.1 Cover happy-path registration, fail-closed invalid portable / settings / collision, no loose Copilot skill double-deploy, multi-target Cursor still materializes, uninstall/prune retire, dry-run no writes
