# Сценарии

Типичные задачи по шагам. Нужна команда `bapm` в проекте: [Быстрый старт](/guide/quick-start). Cursor и свои интеграции: [Поддерживаемые hosts](/guide/supported-hosts).

## Частые

| Сценарий                                                          | Когда                                  |
| ----------------------------------------------------------------- | -------------------------------------- |
| [Свежий install в Cursor](/guide/situations/install-fresh)        | Новый проект, первый манифест и deploy |
| [Команда с разными агентами](/guide/situations/team-local-active) | Общий `bapm.yml`, личный `active`      |
| [Воспроизводимый CI по lock](/guide/situations/ci-frozen)         | Pipeline без дрейфа пинов              |
| [Обновить зависимости](/guide/situations/update-deps)             | Подтянуть mutable refs / tips          |

## По ситуации

| Сценарий                                                       | Когда                              |
| -------------------------------------------------------------- | ---------------------------------- |
| [Policy блокирует MCP](/guide/situations/policy-mcp)           | Approve / deny исполняемого MCP    |
| [Собрать AGENTS.md](/guide/situations/compile-agents)          | Сводка примитивов через `compile`  |
| [Doctor / audit / prune](/guide/situations/doctor-audit-prune) | После поломки или «лишних» modules |

## Реже

| Сценарий                                               | Когда                                                    |
| ------------------------------------------------------ | -------------------------------------------------------- |
| [Marketplace pack](/guide/situations/marketplace-pack) | Marketplace JSON для Claude / Codex (runtime — отдельно) |

Карта команд: [команды](/guide/commands). Флаги: [Справка](/reference/).
