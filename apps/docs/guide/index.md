# Что умеет bapm

bapm собирает конфигурацию AI-агента из пакетов: объявили зависимости → поставили → одинаковый результат у себя, у коллег и в CI.

## На практике

```bash
bapm init -y --target cursor
bapm install --target cursor
```

1. В корне лежит `bapm.yml`.
2. `install` скачивает зависимости, пишет lock и копирует skills / rules / agents / MCP в каталоги выбранного host (Cursor — через `@bapm/integration-cursor` + `targets:`).
3. Дальше — `update`, `outdated`, `compile`, marketplace-pack.

Первый проход: [быстрый старт](/guide/quick-start). Свой агент: [поддерживаемые hosts](/guide/supported-hosts).

## Куда идти

| Если нужно…                    | Откройте                                       |
| ------------------------------ | ---------------------------------------------- |
| Поставить CLI и первый install | [Быстрый старт](/guide/quick-start)            |
| Cursor или свой host           | [Поддерживаемые hosts](/guide/supported-hosts) |
| Список команд                  | [Команды](/guide/commands)                     |
| Флаги конкретной команды       | [Справка](/reference/)                         |
| Разобраться с `bapm.yml`       | [Манифест](/guide/config-manifest)             |
| Lock и CI                      | [Lock-файл](/guide/lockfile)                   |
| Типовая задача по шагам        | [Сценарии](/guide/situations/)                 |

## Ограничения (коротко)

- Cursor / Claude / Codex — opt-in пакеты `@bapm/integration-*` + `targets:` ([hosts](/guide/supported-hosts)). Свой агент — npm / локальный модуль через `targets:`.
- Claude/Codex также эмитят marketplace JSON при `pack`; Cursor, Codex и OpenCode делят `AGENTS.md` (last-writer-wins на compile).
- Граница OpenAPM / APM: [Совместимость](/guide/conformance).
