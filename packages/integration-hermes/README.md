# @b-apm/integration-hermes

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Hermes (Nous Research) **skills + MCP** host for bapm (APM `KNOWN_TARGETS["hermes"]`, primitive profile `hermes`, compile family `agents`).

## Detection vs forced target

| Mode                           | When active                  | Creates roots?              |
| ------------------------------ | ---------------------------- | --------------------------- |
| **Auto-detect**                | Never (`detect` → `false`)   | Never from detect           |
| **Forced** (`--target hermes`) | Explicit forced target id    | MAY `mkdir .agents/skills/` |
| **Manifest** (`active`)        | `active: { target: hermes }` | Same as forced              |

Hermes is stable but **explicit-only** in APM (`detect_by_dir=False`). `.agents/` is shared by several hosts, so its presence does not auto-select Hermes.

## Deploy roots

- `.agents` — skills → `.agents/skills/<name>/SKILL.md` (project scope)
- `.` — compile output `AGENTS.md`

## Materialize routing

| Primitive type      | Destination                                                      |
| ------------------- | ---------------------------------------------------------------- |
| skill               | `.agents/skills/<name>/SKILL.md` (+ portable Agent Plugins copy) |
| instruction/agent/… | skip with `HERMES_PRIMITIVE_UNSUPPORTED` (use compile for docs)  |

## Compile

APM declares `compile_family="agents"`, so `compile` writes project-root `AGENTS.md` and honors `write` for preview vs durable emit. Use a different `-o` path only with the basename `AGENTS.md`.

## MCP path

APM `adapters/client/hermes.py` always writes the single Hermes home config:

- `$HERMES_HOME/config.yaml` (default `~/.hermes/config.yaml`)

The file uses a YAML `mcp_servers:` block with native fields `command`/`args`/`env` for stdio and `url`/`headers` for remote, plus `enabled: true`. Unrelated native keys (model provider, messaging, …) are preserved on every write; a malformed YAML file is never overwritten. The file is credential-bearing and written with mode `0600`.

Install warns that the path is user-global and supports `--exclude hermes` / `BAPM_NO_GLOBAL_MCP=1`.

## Scope

bapm deploys **skills** at project scope (`.agents/skills/`). APM's Hermes MCP config has no project-scope variant: it is always `$HERMES_HOME/config.yaml`, so bapm follows the APM adapter rather than inventing a project `.hermes/config.yaml`.

## Install

```bash
npm i -D @b-apm/integration-hermes
```

```yaml
active:
  target: hermes
```
