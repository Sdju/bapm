# Plugin

Producer-oriented CLI module for `bapm plugin`.

## Public API

- `createPlugin(deps)` creates the command API used by `app/init/plugin.ts`.
- `runPlugin` executes the `init` subcommand.

`bapm plugin init` keeps the existing APM-shaped `plugin.json` + `bapm.yml`
scaffold. `bapm plugin init --agent-plugins` is the explicit portable Agent
Plugins v1 mode: it writes only canonical `plugin.json`; `--skills` opts into
`skills/example/SKILL.md`.

# Plugin

CLI module for `bapm plugin` — thin producer scaffolds (`plugin init`).

## Public API

- `createPlugin(deps)` → `{ run, formatHelp }`
- Types: `PluginDeps`, `PluginOptions`, `PluginResult`

Writes `plugin.json` + plugin-mode `bapm.yml` only. Overwrite requires `--yes`.
Offline — no network / marketplace I/O.
