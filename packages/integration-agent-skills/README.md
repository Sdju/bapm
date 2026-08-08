# @bapm/integration-agent-skills

Cross-client **agent-skills** runtime for bapm: skills-only deploy to `.agents/skills/`.

## Surface

| Capability | Export                                               | When                                           |
| ---------- | ---------------------------------------------------- | ---------------------------------------------- |
| Runtime    | `createAgentSkillsIntegration` / `createIntegration` | `targets.agent-skills` + `active` / `--target` |

Thin host: **no** MCP, hooks, or compile.

## Detection vs forced / active

| Mode                                  | When active                                                        | Creates roots?                               |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| **Auto-detect**                       | Never (`detect` always false — `.agents/` is shared)               | Never from detect                            |
| **Forced** (`--target agent-skills`)  | Explicit forced target id                                          | MAY `mkdir` `.agents/skills/` on materialize |
| **Manifest `active: [agent-skills]`** | After object-map registration, without requiring filesystem detect | Same as forced                               |

## Deploy roots

- `.agents` — skills → `.agents/skills/<name>/SKILL.md`

## Materialize routing

| Primitive type      | Destination                                                          |
| ------------------- | -------------------------------------------------------------------- |
| skill               | `.agents/skills/<name>/SKILL.md` (+ portable Agent Plugins dir copy) |
| instruction/agent/… | skip (non-fatal diagnostic `AGENT_SKILLS_PRIMITIVE_UNSUPPORTED`)     |

Shared path with Cursor/Codex/Copilot/antigravity under `.agents/skills/` is intentional.

## Opt-in

```yaml
targets:
  agent-skills: "@bapm/integration-agent-skills"
active:
  - agent-skills
```
