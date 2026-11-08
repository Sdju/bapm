# bapm targets — интроспекция агентов

Read-only команда: показывает интеграции агентов, которые bapm загрузил для текущего проекта. Ничего не пишет — ни файлы агентов, ни lock, ни конфиг.

## Использование

```text
bapm targets [--json] [--all]
```

| Флаг        | Эффект                                                           |
| ----------- | ---------------------------------------------------------------- |
| `--json`    | Стабильный JSON вместо таблицы                                   |
| `--all`     | Добавить известных канонических хостов без установленной интеграции |
| `--help`    | Показать help                                                    |

`--target` команда не принимает: это интроспекция, а не установка.

## Колонки

| Колонка        | Значение                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `TARGET`       | id зарегистрированной интеграции (например `cursor`, `x-acme-editor`)     |
| `STATUS`       | `active`, `detected` или `inactive`                                       |
| `SOURCE`       | Почему target активен: `local_overlay`, `manifest`, `config` или `detect`  |
| `DEPLOY ROOTS` | `deployRoots`, которые интеграция объявила                                |
| `MCP`          | `project` или `home` — куда target пишет MCP-конфиг                       |
| `COMPILE`      | Есть ли у target собственная реализация `compile()`                       |

`active` повторяет выбор install: `active` из `bapm.local.yml` → `active` из `bapm.yml` → `target` из `~/.bapm/config.json` → единственное автоопределение. Если маркеров несколько, строки показывают `detected`, но ни одна не становится `active` — install в таком случае попросит `--target`.

## JSON

Поля и порядок строк стабильны (сортировка по id):

```json
[
  {
    "target": "cursor",
    "id": "cursor",
    "status": "active",
    "active": true,
    "detected": false,
    "registered": true,
    "source": "manifest",
    "deployRoots": [".cursor", ".agents"],
    "mcpScope": "project",
    "compile": true
  }
]
```

`--all` добавляет строки канонических хостов, для которых пакет интеграции не установлен: `registered: false`, пустые `deployRoots`, `mcpScope: null`, `compile: false`.

## Без манифеста

Если в каталоге нет `bapm.yml` / `apm.yml`, bapm не загружает канонические интеграции. `bapm targets --json` вернёт `[]`; `bapm targets --all --json` покажет известные id как незарегистрированные. Установите пакет (`npm i -D @b-apm/integration-<id>`) или объявите `targets:` в манифесте.

## См. также

- [Выбор агента](/guide/host-selection)
- [Поддерживаемые агенты](/guide/supported-hosts)
- [config](/reference/config)
