# bapm config — пользовательские настройки

Тонкая обёртка над `~/.bapm/config.json`. Тот же файл хранит grant-ы `bapm approve` / `bapm deny`; `config` не удаляет их.

## Использование

```text
bapm config
bapm config list [--json]
bapm config get <key>
bapm config set target <id>
bapm config unset target
```

| Команда                      | Эффект                                                       |
| ---------------------------- | ------------------------------------------------------------ |
| `config` / `config list`     | Показать `target`, число allow/deny grant-ов и путь к файлу    |
| `config list --json`         | Весь документ конфига в JSON (`target: null`, если не задан)  |
| `config get target`          | Напечатать значение target; exit 1, если не задан             |
| `config set target <id>`     | Записать target по умолчанию                                  |
| `config unset target`        | Удалить target; остальные ключи остаются                      |

`--help`, `-h` показывают справку. Неизвестные флаги и ключи отвергаются.

## `target`: агент по умолчанию

`target` — последний явный источник перед автоопределением. Полный порядок выбора:

1. `--target <id>` в `install` / `compile`;
2. `active` в `bapm.local.yml`;
3. `active` в `bapm.yml`;
4. `target` из `~/.bapm/config.json`;
5. единственное автоопределение по маркеру;
6. ошибка, если ничего не сработало.

Значение из конфига не переопределяет проектный `active`: удобно держать личный default, а в командном проекте закрепить агента в манифесте. `bapm targets` показывает источник (`SOURCE=config`).

```bash
bapm config set target cursor   # личный default
bapm targets --json             # STATUS=active, SOURCE=config (если active нет)
bapm config unset target
```

Изменить target можно только валидным id: строчные буквы, цифры, `.`, `_`, `-`; например `cursor`, `claude`, `grok-build`, `x-acme-editor`.

## Хранение и grant-ы

`config set` / `unset` делают read-merge-write: читают текущий JSON, меняют только `target`, пишут через временный файл и `rename` (атомарно). `executables.allow` / `executables.deny`, созданные `bapm approve` / `bapm deny`, сохраняются без изменений. Права на файл — `0600`, каталог — `0700` (best-effort на платформах без POSIX mode).

```json
{
  "target": "cursor",
  "executables": {
    "allow": { "mcp-dep": { "mcp": true } },
    "deny": {}
  }
}
```

Секретов в этом файле нет: только id target и grant-ы пакетов.

## См. также

- [targets](/reference/targets)
- [Выбор агента](/guide/host-selection)
- [MCP и политика](/guide/situations/policy-mcp)
