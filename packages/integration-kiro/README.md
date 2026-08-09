# @bapm/integration-kiro

Kiro IDE/CLI **runtime** host for bapm (project-scope `.kiro/` primitives + translate MCP).

## Opt-in load

```bash
npm i -D @bapm/integration-kiro
```

```yaml
targets:
  kiro: "@bapm/integration-kiro"
active:
  - kiro
```

```bash
bapm init -y --target kiro
bapm install --target kiro
bapm compile --target kiro
```

## Detection vs forced target

| Mode                         | When active                       | Creates roots?                                      |
| ---------------------------- | --------------------------------- | --------------------------------------------------- |
| **Auto-detect**              | Project `.kiro/` directory exists | Only when materialize / configure runs after detect |
| **Forced** (`--target kiro`) | Explicit forced target id         | MAY `mkdir` `.kiro/` as needed                      |

Auto-detect without `.kiro/` MUST NOT create the directory solely for detection.

## Deploy roots

- `.kiro` — steering, agents, skills, hooks, MCP settings, ownership sidecar
- `.` — thin `AGENTS.md` compile output

## Materialize routing

| Primitive type   | Destination                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| instruction      | `.kiro/steering/<name>.md` (`applyTo` → `inclusion: fileMatch` + `fileMatchPattern`; else `always`) |
| agent            | `.kiro/agents/<name>.md` (FM: `description` / `model` / `tools` only; tools fail-closed)            |
| skill            | `.kiro/skills/<name>/` (never `.agents/skills/`)                                                    |
| hook             | per-file `.kiro/hooks/<pkg>-<stem>-<event>-<n>.json` (**v1** + scripts) + `.kiro/bapm-hooks.json`   |
| command / prompt | **skipped** (APM matrix N)                                                                          |

MCP is **not** written by materialize — only via `configureMcp`.

## MCP (translate)

- Config: `.kiro/settings/mcp.json` (`mcpServers`), opt-in when `.kiro/` exists
- `mcpEnvMode: "translate"` — APM `${VAR}` / `${env:VAR}` / `<VAR>` stay as runtime `${VAR}`
- Unrelated servers and top-level keys are preserved

## Compile

Thin emitter → `AGENTS.md`. Instruction primitives already deployed as steering are omitted from the compile body.

## Exports

- `createKiroIntegration` / `createIntegration` — runtime factory (`id: "kiro"`)
- `KIRO_AGENT_ALLOWED_TOOLS` — approved capability tags
- `transformKiroSteeringMarkdown` — instruction → steering helper
