# Portable Agent Plugins v1

Узкая portable-граница: корневой `plugin.json`, `skills/<name>/SKILL.md`, корневой `mcp.json`, плюс объявленные в `plugin.json` пути `commands` / `hooks` (fail-closed).

```text
my-plugin/
  plugin.json
  mcp.json
  skills/
    hello/
      SKILL.md
  commands/
    ship.md          # если указано в plugin.json → commands
  hooks/
    session.json     # если указано в plugin.json → hooks
```

Матрица поддержки: [AGENT_PLUGINS_COMPATIBILITY.md](../../../AGENT_PLUGINS_COMPATIBILITY.md) (fixtures + тесты, не сертификация).

## В Cursor

Cursor-integration адаптирует portable MCP в `.cursor/mcp.json`: `stdio` → `stdio`, `streamable-http` → `http`, `sse` → `sse`. Portable MCP-файл **не** копируется as-is. Declared commands → `.cursor/commands/<name>.md`; declared hooks → merge `.cursor/hooks.json` (скрипты под `.cursor/hooks/`).

## В OpenCode

Пакет `@bapm/integration-opencode` (opt-in через `targets:`) адаптирует portable MCP в project `opencode.json` под `mcp`: `stdio` → `type: "local"` + `command` array, `streamable-http` → `type: "remote"` + `url`. Portable `sse` **не** мапится молча (fail-closed). Skills копируются в `.opencode/skills/`. Commands → `.opencode/commands/`; hooks явно пропускаются с diagnostic (не supported).

## Граница

- `plugin.json` ≠ `bapm.yml` / `apm.yml`
- Упаковка portable-плагина — архив, не публикация в marketplace
- OpenAPM в [CONFORMANCE.md](../../../CONFORMANCE.md) ≠ conformance Agent Plugins
- Объявленные `commands` / `hooks` — требования: missing/escape → fail-closed до deploy/lock

Marketplace-output и portable-архивы независимы от Cursor/OpenCode runtime install.

## Что не поддерживается

Sandboxing, OAuth, инъекция секретов, undeclared agents, client extensions, vendor-specific расширения. Небезопасные пути skills и secret-подобные MCP env отклоняются.
