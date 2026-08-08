# @bapm/integration-opencode

Minimal **OpenCode** host for bapm (detect, materialize skills/agents/commands, MCP configure, compile).

## Detection vs forced target

| Mode                             | When active                                                                          | Creates roots?                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **Auto-detect**                  | `.opencode/` **directory** **or** `opencode.json` / `opencode.jsonc` at project root | Only when materialize / configureMcp runs after a positive detect    |
| **Forced** (`--target opencode`) | Explicit CLI/core forced target id, even if detect is false                          | MAY `mkdir` registered roots (`.opencode/`, skills/agents) as needed |

Auto-detect without force MUST NOT create `.opencode/` solely for MCP opt-in. Forced activation is owned by Install / CLI; this package’s `detect` stays an honest presence predicate. Lone project-root `AGENTS.md` is **not** an OpenCode signal (shared compile family with Cursor/Codex).

## Deploy roots

Registered roots:

- `.opencode` — skills → `skills/<name>/SKILL.md`, agents → `agents/<name>.md`, commands → `commands/<name>.md`
- `.` — project-root `opencode.json` (MCP) and compile `AGENTS.md` (writers hard-limit basenames)

## Materialize routing

| Primitive type | Destination                                                          |
| -------------- | -------------------------------------------------------------------- |
| skill          | `.opencode/skills/<name>/SKILL.md`                                   |
| agent          | `.opencode/agents/<name>.md`                                         |
| command        | `.opencode/commands/<name>.md`                                       |
| instruction    | skip (compile-only → `AGENTS.md`; non-fatal diagnostic)              |
| hook           | skip (`OPENCODE_HOOKS_UNSUPPORTED`)                                  |

Skills stay under `.opencode/skills/` (not APM `.agents/skills/`). Writes never escape registered roots.
**Materialize does not write `opencode.json`.** MCP is only via `configureMcp`.

## Compile

`compile` defaults to project-root `AGENTS.md`, **includes** instruction primitives, and honors `write` for preview vs durable emit. Cursor, Codex, and OpenCode share the `AGENTS.md` family: **last writer wins** per invocation.

## MCP configure (`configureMcp`)

- Creates/updates project-root `opencode.json` under top-level `mcp`
- Portable/`stdio` → `{ type: "local", command: [command, ...args], environment? }`
- Portable `streamable-http` / host `http` → `{ type: "remote", url, headers? }`
- Portable `sse` (and undocumented transports) fail closed — diagnostic, no invented entry
- Preserves unrelated top-level keys and other `mcp` server names
- Returns `ConfigureMcpReport` (`configPath: "opencode.json"`, `servers`, `deployedFiles`) for lock inventory

## Activation

```yaml
targets:
  opencode: "@bapm/integration-opencode"
active:
  - opencode
```

```bash
npm i -D @bapm/integration-opencode
bapm install --target opencode
```

## Dependencies

Depends only on `@bapm/integration-api` among bapm packages — not `@bapm/core`.
Register via `createIntegrationRegistry().register(createOpencodeIntegration())` in CLI or tests.
Named `createIntegration` is also exported for object-map load.
