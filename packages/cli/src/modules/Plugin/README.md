# Plugin

CLI module for `bapm plugin` — thin producer scaffolds (`plugin init`).

## Public API

- `createPlugin(deps)` → `{ run, formatHelp }`
- Types: `PluginDeps`, `PluginOptions`, `PluginResult`

Writes `plugin.json` + plugin-mode `bapm.yml` only. Overwrite requires `--yes`.
Offline — no network / marketplace I/O.
