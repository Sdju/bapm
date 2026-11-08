# @b-apm/integration-grok-bot

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Grok Bot **skills** host for bapm (APM `KNOWN_TARGETS["grok-bot"]`).

## Detection vs forced target

| Mode                             | When active                    | Creates roots?                              |
| -------------------------------- | ------------------------------ | ------------------------------------------- |
| **Auto-detect**                  | Never (`detect` → `false`)     | Never from detect                           |
| **Forced** (`--target grok-bot`) | Explicit forced target id      | MAY `mkdir agent-data/workflows/` as needed |
| **Manifest** (`active`)          | `active: { target: grok-bot }` | Same as forced                              |

Grok Bot is **explicit-only** in APM: it has no filesystem marker and is never
included in auto-detection or `all`. Presence of `agent-data/` alone does not
activate the host.

## Deploy roots

- `agent-data` — skills → `agent-data/workflows/<name>/SKILL.md`

## Materialize routing

| Primitive type      | Destination                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| skill               | `agent-data/workflows/<name>/SKILL.md` (+ portable Agent Plugins dir copy) |
| instruction/agent/… | skip (non-fatal diagnostic `GROK_BOT_PRIMITIVE_UNSUPPORTED`)               |

APM `grok-bot` is skills-only: it has no agents, commands, rules, or hooks.
The target also accepts packages that declare the cross-client `agent-skills`
target, because only skills deploy there.

## Scope

APM also supports `--global` (`~/agent-data/workflows/`). **bapm is
project-scope only**, so this package deploys to the project
`agent-data/workflows/` and has no user-scope mode.

## No MCP / compile

APM `grok-bot` declares no `compile_family` and no MCP surface; this package
provides neither `configureMcp` nor `compile`.

## Install

```bash
npm i -D @b-apm/integration-grok-bot
```

The canonical id resolves the package without a `targets:` entry:

```yaml
active:
  target: grok-bot
```

A root `targets:` map also restricts deployment to the listed hosts, so add it
only to override the module.
