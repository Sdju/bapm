# Что умеет bapm

bapm собирает конфигурацию AI-агента из пакетов: объявили зависимости → поставили → одинаковый результат у себя, у коллег и в CI.

## На практике

```bash
npm i -D @bapm/integration-cursor
bapm install
```

1. В корне лежит `bapm.yml`.
2. `install` находит агента (detect / `active` / `--target`), подтягивает стандартный `@bapm/integration-*` при необходимости и копирует skills / rules / agents / MCP в layout host.
3. Дальше — `update`, `outdated`, `compile`, marketplace-pack.

Первый проход: [быстрый старт](/guide/quick-start). Выбор host: [host selection](/guide/host-selection). Свой агент: [supported hosts](/guide/supported-hosts).

## Куда идти

| Если нужно…                    | Откройте                                       |
| ------------------------------ | ---------------------------------------------- |
| Поставить CLI и первый install | [Быстрый старт](/guide/quick-start)            |
| Понять detect / active / map   | [Как выбирается host](/guide/host-selection)   |
| Таблица hosts и custom targets | [Поддерживаемые hosts](/guide/supported-hosts) |
| Список команд                  | [Команды](/guide/commands)                     |
| Флаги конкретной команды       | [Справка](/reference/)                         |
| Разобраться с `bapm.yml`       | [Манифест](/guide/config-manifest)             |
| Команда с разными агентами     | [Personal overlay](/guide/manifest-overlay)    |
| Lock и CI                      | [Lock-файл](/guide/lockfile)                   |
| Типовая задача по шагам        | [Сценарии](/guide/situations/)                 |

## Ограничения (коротко)

- Hosts — opt-in пакеты `@bapm/integration-*` (не бандл CLI). Canonical fallback без `targets:`; map — override/custom.
- Claude/Codex также эмитят marketplace JSON при `pack`; Cursor, Codex и OpenCode делят `AGENTS.md` (last-writer-wins на compile).
- Граница OpenAPM / APM: [Совместимость](/guide/conformance).
