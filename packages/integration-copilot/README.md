# @bapm/integration-copilot

GitHub Copilot **runtime** host for bapm (project-scope file primitives + home MCP translate).

## Opt-in load

```bash
npm i -D @bapm/integration-copilot
```

```yaml
targets:
  copilot: "@bapm/integration-copilot"
active:
  - copilot
```

```bash
bapm install --target copilot
bapm compile --target copilot
```

## Detection vs forced target

| Mode                            | When active                                                                                                 | Creates roots?                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Auto-detect**                 | Any whitelist signal under `.github/` (`copilot-instructions.md` or instructions/agents/prompts/hooks dirs) | Only when materialize / configure runs after detect |
| **Forced** (`--target copilot`) | Explicit forced target id, even if detect is false                                                          | MAY `mkdir` `.github/` / `.agents/` as needed       |

Auto-detect without a whitelist signal MUST NOT create roots solely for detection.

## Deploy roots

- `.github` — instructions, prompts, agents, hooks, compile output, ownership sidecar
- `.agents` — portable skills under `.agents/skills/<name>/`

Home MCP (`~/.copilot/mcp-config.json`, override with `COPILOT_HOME`) is outside project deploy roots.

## Materialize routing

| Primitive type   | Destination                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| instruction      | `.github/instructions/<name>.instructions.md` (preserve `applyTo` / Copilot FM)                     |
| command / prompt | `.github/prompts/<name>.prompt.md` (never `.github/commands/`)                                      |
| agent            | `.github/agents/<name>.agent.md`                                                                    |
| skill            | `.agents/skills/<name>/` (never `.github/skills/`)                                                  |
| hook             | per-file `.github/hooks/<pkg>-<stem>.json` + scripts under `.github/hooks/scripts/<pkg>/` + sidecar |

MCP is **not** written by materialize — only via `configureMcp`.

## MCP (translate)

- Config: `~/.copilot/mcp-config.json` (`mcpServers`)
- `mcpEnvMode: "translate"` — APM `${VAR}` / `${env:VAR}` / `<VAR>` stay as runtime `${VAR}` placeholders
- Install skips bake for this host; unrelated servers and top-level keys are preserved
- Never writes project `.vscode/mcp.json`

## Compile

Thin emitter → `.github/copilot-instructions.md`. Instruction primitives already deployed under `.github/instructions/` are omitted from the compile body. Honors `write` vs validate/preview.

## Exports

- `createCopilotIntegration` / `createIntegration` — runtime factory (`id: "copilot"`)
