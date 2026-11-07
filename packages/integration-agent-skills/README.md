# @b-apm/integration-agent-skills

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Cross-client **agent-skills** runtime for bapm: skills-only deploy to `.agents/skills/`.

## Surface

| Capability | Export                                               | When                  |
| ---------- | ---------------------------------------------------- | --------------------- |
| Runtime    | `createAgentSkillsIntegration` / `createIntegration` | `active` / `--target` |

Thin host: **no** MCP, hooks, or compile.

## Detection vs forced / active

| Mode                                            | When active                                          | Creates roots?                               |
| ----------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| **Auto-detect**                                 | Never (`detect` always false — `.agents/` is shared) | Never from detect                            |
| **Forced** (`--target agent-skills`)            | Explicit forced target id                            | MAY `mkdir` `.agents/skills/` on materialize |
| **Manifest `active: { target: agent-skills }`** | Without requiring filesystem detect                  | Same as forced                               |

## Deploy roots

- `.agents` — skills → `.agents/skills/<name>/SKILL.md`

## Materialize routing

| Primitive type      | Destination                                                          |
| ------------------- | -------------------------------------------------------------------- |
| skill               | `.agents/skills/<name>/SKILL.md` (+ portable Agent Plugins dir copy) |
| instruction/agent/… | skip (non-fatal diagnostic `AGENT_SKILLS_PRIMITIVE_UNSUPPORTED`)     |

Shared path with Cursor/Codex/Copilot/antigravity under `.agents/skills/` is intentional.

## Opt-in

Install the package next to the CLI; the canonical id resolves `@b-apm/integration-agent-skills` without a `targets:` entry.

```yaml
active:
  target: agent-skills
```

A root `targets:` map also restricts deployment to the listed hosts, so add it only to override the module.
