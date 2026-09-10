## Why

APM 0.29 registers portable Agent Plugins 1.0 for GitHub Copilot **natively**: the package stays under `apm_modules/`, Copilot CLI ≥1.0.81 loads it live (no copy into private state, no `--plugin-dir`), and install writes a catalog + settings projection instead of decomposing the plugin into loose Copilot primitives. bapm already validates/discovers portable roots and has `@b-apm/integration-copilot` for file/MCP materialize, but `install --target copilot` still has no native registration path—so Copilot either misses whole-plugin loading or would double-load if skills/MCP were also projected loosely.

## What Changes

- When effective install targets include `copilot`, admit dependencies that are **portable Agent Plugins 1.0** (canonical root `plugin.json` + Agent Plugins schema boundary) and **register them natively** while the package remains under the existing modules root `apm_modules/` (wire parity; `bapm_modules` alias stays deferred).
- Rebuild an owned catalog + ownership ledger under `apm_modules/.github/plugin/`, and merge namespaced keys into project `.github/copilot/settings.local.json` (`extraKnownMarketplaces` + `enabledPlugins`) so Copilot loads plugins live from the modules tree.
- For those admitted portable plugins on the Copilot target: **do not** copy into Copilot private state, **do not** require `--plugin-dir`, and **do not** decompose `skills/` / root `mcp.json` into loose Copilot harness primitives (avoids double-load).
- **Fail-closed** when a package is treated as an Agent Plugin for this path but is not a valid portable AP 1.0 root (invalid/missing portable contract)—no silent copy/`--plugin-dir` fallback.
- Do **not** locate, execute, or version-check a Copilot binary during install/update/restore/uninstall/prune; document that live loading needs Copilot CLI ≥1.0.81.
- Docs: VitePress agent-plugins / Copilot host notes + compatibility matrix narrative for the Copilot-native registration row.
- Lifecycle: uninstall/prune MUST retire only bapm-owned catalog rows and `@…` settings keys written by this registration (project scope).

### Non-goals (this change)

- `--trust-bin` / exclusive `plugin.json` `skills:` (already shipped).
- `pack --check-versions` + plugin.json-only pack; OpenAPM `req-pl-018`; policy canonical identity casing.
- Full rename of authoring flags to APM `--format agent-plugin` (`bapm` already has `--agent-plugins` on `pack` / `plugin init`—sufficient for producing portable roots; rename only if later proven blocking).
- Hermes; Homebrew/`install.sh`; `.bapmignore`.
- Canvas / `.github/extensions/`; global `-g` / `$COPILOT_HOME` registration (project-scope first; global as follow-up).
- Requiring Copilot to be installed at install time; binary pin e2e against real Copilot CLI in CI (docs + fixture-level projection tests only).

### Follow-ups (not tasks of this change)

1. `pack-check-versions-plugin-json`
2. `policy-canonical-identity-casing`
3. Optional: global Copilot settings registration (`-g` / `COPILOT_HOME`); authoring flag alias `--format agent-plugin`

## Capabilities

### New Capabilities

- `copilot-native-agent-plugins`: Project-scope native registration of portable Agent Plugins 1.0 for the Copilot target—catalog + ledger under `apm_modules/.github/plugin/`, merge into `.github/copilot/settings.local.json`, no copy/`--plugin-dir`, no loose skill/MCP projection for admitted plugins, fail-closed non-portable admission, collision/ownership rules, lifecycle retire of owned keys.

### Modified Capabilities

- `install-pipeline`: After materialize of modules, when Copilot is an effective target, run native Agent Plugin registration for admitted portable plugins; skip loose Copilot primitive projection for those package roots; fail closed before lock commit on invalid portable admission / settings collisions that refuse overwrite.
- `integration-copilot-runtime`: Document that portable Agent Plugins on Copilot use native registration rather than skills/MCP materialize for those packages; keep existing non-plugin primitive materialize unchanged.
- `agent-plugins-compatibility`: Add Copilot-native registration as an in-boundary, fixture-backed support case (not a marketplace/OpenAPM claim).
- `lifecycle-uninstall-prune`: Uninstall/prune MUST remove only owned native-registration catalog rows and settings keys, then drop empty generated catalog artifacts.

## Impact

- `@b-apm/core`: Install orchestration (+ possibly thin AgentPlugins or Copilot-registration helper); uninstall/prune ownership cleanup.
- `@b-apm/integration-copilot`: may expose helpers or stay out of core-owned registration (design chooses ownership so core still does not hard-depend on the integration package).
- Docs: `apps/docs/guide/agent-plugins.md`, supported-hosts / Copilot notes; `AGENT_PLUGINS_COMPATIBILITY.md` + `tests/agent-plugins/compatibility-cases.json`.
- Tests in later orchestration phases (acceptance → promote); no new workspace packages expected.
- Authoring CLI (`--agent-plugins`) unchanged in this slice.
