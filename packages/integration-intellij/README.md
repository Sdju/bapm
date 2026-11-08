# @b-apm/integration-intellij

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

IntelliJ / JetBrains Copilot **MCP-only** host for bapm (APM `KNOWN_TARGETS["intellij"]`, `mcp_only=True`, copilot primitive profile).

## Detection vs forced target

| Mode                             | When active                    | Creates roots? |
| -------------------------------- | ------------------------------ | -------------- |
| **Auto-detect**                  | Never (`detect` → `false`)     | Never          |
| **Forced** (`--target intellij`) | Explicit forced target id      | No             |
| **Manifest** (`active`)          | `active: { target: intellij }` | No             |

APM has no project marker for JetBrains Copilot; bapm keeps the host explicit-only. Presence of `.idea/` does **not** auto-select it.

## MCP only

This package provides `configureMcp` and no `materialize` file output and no `compile`. File primitives are not deployed for `intellij`; install emits a non-fatal `INTELLIJ_PRIMITIVE_UNSUPPORTED` diagnostic.

APM routes IntelliJ file primitives through the Copilot profile. bapm keeps the integration MCP-only so `--target intellij` never guesses a file layout.

## MCP path

APM `adapters/client/intellij.py` writes a single **user-scope** file:

- Windows: `%LOCALAPPDATA%\github-copilot\intellij\mcp.json`
- macOS/Linux: `$XDG_CONFIG_HOME/github-copilot/intellij/mcp.json` (default `~/.config`)

The document uses a top-level `servers` object. Native `${env:VAR}` placeholders are preserved (bapm `mcpEnvMode: "translate"`), so secrets are not baked into the file. Existing servers and unrelated top-level keys are preserved; `managedServers` are pruned on update/deny.

> Gap note: the task brief mentioned a project-scope path. APM 0.35 has no project-scope JetBrains Copilot MCP config — the adapter always uses the user-scope path above, so bapm follows APM instead of inventing `.idea/mcp.json`.

## Install

```bash
npm i -D @b-apm/integration-intellij
```

```yaml
active:
  target: intellij
```
