# Portable Agent Plugins v1

Узкая portable-граница: корневой `plugin.json`, skills (conventional или exclusive declaration), корневой `mcp.json`, плюс объявленные в `plugin.json` пути `commands` / `hooks` (fail-closed).

```text
my-plugin/
  plugin.json          # optional skills: omit | [] | ["name", "skills/x", "skills"]
  mcp.json
  skills/
    hello/
      SKILL.md
  commands/
    ship.md          # если указано в plugin.json → commands
  hooks/
    session.json     # если указано в plugin.json → hooks
```

## `plugin.json` `skills:` (exclusive)

| Форма             | Поведение                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ключ **опущен**   | Conventional discovery: только immediate `skills/<name>/SKILL.md`                                                                                             |
| `"skills": []`    | **Ноль** skills, даже если каталог есть; shadow-диагностика, если conventional entries существуют                                                             |
| `"skills": ["…"]` | Exclusive list: только разрешённые имена / `skills/<name>` / контейнер `skills` или `./skills`; missing / traversal / escape → **fail-closed** до deploy/lock |

Это **не** то же самое, что consumer object-form dep `skills:` (deps-object-subset): на стороне зависимости пустой список — parse error; на стороне плагина пустой список — намеренный zero deploy.

Матрица поддержки: [AGENT_PLUGINS_COMPATIBILITY.md](../../../AGENT_PLUGINS_COMPATIBILITY.md) (fixtures + тесты, не сертификация).

## В Cursor

Cursor-integration адаптирует portable MCP в `.cursor/mcp.json`: `stdio` → `stdio`, `streamable-http` → `http`, `sse` → `sse`. Portable MCP-файл **не** копируется as-is. Declared commands → `.cursor/commands/<name>.md`; declared hooks → merge `.cursor/hooks.json` (скрипты под `.cursor/hooks/`).

## В OpenCode

Пакет `@b-apm/integration-opencode` (opt-in через `targets:`) адаптирует portable MCP в project `opencode.json` под `mcp`: `stdio` → `type: "local"` + `command` array, `streamable-http` → `type: "remote"` + `url`. Portable `sse` **не** мапится молча (fail-closed). Skills копируются в `.opencode/skills/`. Commands → `.opencode/commands/`; hooks явно пропускаются с diagnostic (не supported).

## Граница

- `plugin.json` ≠ `bapm.yml` / `apm.yml`
- Упаковка portable-плагина — архив, не публикация в marketplace
- OpenAPM в [CONFORMANCE.md](../../../CONFORMANCE.md) ≠ conformance Agent Plugins
- Объявленные `commands` / `hooks` / exclusive `skills` — требования: missing/escape → fail-closed до deploy/lock

Marketplace-output и portable-архивы независимы от Cursor/OpenCode runtime install.

## Что не поддерживается

Sandboxing, OAuth, инъекция секретов, undeclared agents, client extensions, vendor-specific расширения. Небезопасные пути skills и secret-подобные MCP env отклоняются.
