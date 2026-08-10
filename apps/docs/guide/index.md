# Что умеет bapm

bapm — как npm / pip для AI-агента: объявили зависимости в `bapm.yml` → `bapm install` → одинаковый результат у себя, у коллег и в CI.

## Зачем это на практике

- Быстро ставить skills, rules, agents и MCP
- Тянуть модули из private registry
- Разделять командные и личные возможности агента ([overlay](/guide/manifest-overlay))
- Держать разные агенты на одном проекте и переиспользовать общие артефакты
- Задавать корпоративные политики ([policy](/guide/situations/policy-mcp))

## Happy path

::: warning UNSTABLE
Ранний публичный релиз на npm. Примеры `npm i` рабочие, но API/layout могут меняться. **Не для production.**
:::

```bash
npm i -g @b-apm/cli @b-apm/integration-cursor
# cwd с .cursor/ и bapm.yml
bapm install
```

1. В корне лежит `bapm.yml`.
2. `install` находит агента (detect / `active` / `--target`), подтягивает стандартный `@b-apm/integration-*` при необходимости и копирует skills / rules / agents / MCP в layout host.
3. Дальше — `update`, `outdated`, `compile`, marketplace-pack.

Первый проход: [быстрый старт](/guide/quick-start). Выбор host: [host selection](/guide/host-selection). Свой агент: [supported hosts](/guide/supported-hosts).

## Почему не APM?

Кратко vs [microsoft/apm](https://github.com/microsoft/apm): нет привязки к одному агенту; отдельные integration packages; кастомные агенты; акцент на командной работе и личных vs командных артефактах. Подробнее о границе OpenAPM / APM CLI: [Совместимость](/guide/conformance).

**SOON:** кастомные артефакты / паттерны; плагины bapm.

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

- Hosts — отдельные пакеты `@b-apm/integration-*` (не бандл CLI). Canonical fallback без `targets:`; map — override/custom.
- Claude/Codex также эмитят marketplace JSON при `pack`; Cursor, Codex и OpenCode делят `AGENTS.md` (last-writer-wins на compile).
- Граница OpenAPM / APM: [Совместимость](/guide/conformance).
