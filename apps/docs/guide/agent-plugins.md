# Portable Agent Plugins v1

bapm поддерживает узкую portable-границу Agent Plugins v1: корневой `plugin.json`, каталоги `skills/<name>/SKILL.md` на одном уровне и корневой `mcp.json`.

Сгенерированная [матрица поддержки](../../../AGENT_PLUGINS_COMPATIBILITY.md) опирается на fixtures и регрессионные тесты. Это не сертификация Agent Plugins и не заявление о совместимости со всеми клиентами.

## Поведение в Cursor

Cursor-integration адаптирует portable MCP-записи в `.cursor/mcp.json`: `stdio` остаётся `stdio`, `streamable-http` становится `http`, `sse` остаётся `sse`. Portable MCP-файл никогда не копируется в Cursor как есть. Другим хостам нужна своя явная integration.

## Граница

Portable-плагины отличаются и от манифестов bapm/OpenAPM, и от marketplace-продуктов:

- `plugin.json` — это не `bapm.yml` и не `apm.yml`;
- упаковка portable-плагина создаёт архив, а не публикацию в marketplace;
- заявления OpenAPM в [CONFORMANCE.md](../../../CONFORMANCE.md) не означают conformance Agent Plugins.

Marketplace-output integrations и portable-архивы плагинов поддерживаются независимо от runtime-материализации в Cursor. Они не подразумевают расширение клиента, публикацию в marketplace или runtime-адаптер для каждого хоста.

## Что не поддерживается

На этой поверхности нет sandboxing, OAuth или инъекции секретов, hooks, agents, commands, client extensions и vendor-specific расширений. Небезопасные пути skills и зарезервированные / secret-подобные переменные окружения MCP отклоняются.
