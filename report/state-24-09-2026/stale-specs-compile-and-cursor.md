# Устаревшие спеки `compile-agents-md` и `cursor-mcp-deploy`

**Статус:** открыто  
**Класс:** долг спеки

## Суть

Две capability-спеки описывают ранний cursor-only срез. Код и пользовательские docs ушли дальше. Это не баг runtime, а ложный контракт для агентов.

## Состояние

| Источник     | Позиция                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| APM          | Compile/MCP эволюционировали отдельно.                                                                                  |
| OpenAPM      | Compile и MCP — host-agnostic.                                                                                          |
| Спека bapm   | `compile-agents-md` — лексика одного хоста / старые пути. `cursor-mcp-deploy` — detect honesty и cursor-only configure. |
| Код bapm     | Compile для любого compile-capable зарегистрированного id. MCP — per-integration.                                       |
| Документация | `guide/situations/compile-agents.md`, `supported-hosts.md`.                                                             |

## Вариации

1. Переписать спеки под shipped multi-host (follow-up 4.2 change `sync-specs`).
2. Пометить capabilities retired.
3. Оставить — агент «исправит» код под старую спеку.

## Поведение сейчас

Истина — CLI + integration packages. Спеки не архивированы и формально действующие.
