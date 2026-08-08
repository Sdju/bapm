# Portable Agent Plugins v1

Узкая portable-граница: корневой `plugin.json`, `skills/<name>/SKILL.md`, корневой `mcp.json`.

```text
my-plugin/
  plugin.json
  mcp.json
  skills/
    hello/
      SKILL.md
```

Матрица поддержки: [AGENT_PLUGINS_COMPATIBILITY.md](../../../AGENT_PLUGINS_COMPATIBILITY.md) (fixtures + тесты, не сертификация).

## В Cursor

Cursor-integration адаптирует portable MCP в `.cursor/mcp.json`: `stdio` → `stdio`, `streamable-http` → `http`, `sse` → `sse`. Portable MCP-файл **не** копируется as-is.

## Граница

- `plugin.json` ≠ `bapm.yml` / `apm.yml`
- Упаковка portable-плагина — архив, не публикация в marketplace
- OpenAPM в [CONFORMANCE.md](../../../CONFORMANCE.md) ≠ conformance Agent Plugins

Marketplace-output и portable-архивы независимы от Cursor runtime install.

## Что не поддерживается

Sandboxing, OAuth, инъекция секретов, hooks, agents, commands, client extensions, vendor-specific расширения. Небезопасные пути skills и secret-подобные MCP env отклоняются.
