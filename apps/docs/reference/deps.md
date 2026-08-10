# bapm deps — флаги

По `bapm deps --help`.

## Использование

```text
bapm deps list
bapm deps tree
bapm deps why <package|owner/repo|basename> [--json]
bapm deps clean [-y|--yes] [--dry-run]
```

Без подкоманды по умолчанию — `list`. Неизвестные подкоманды и флаги отвергаются. Флаги привязаны к подкомандам (`--json` только у `why`; `-y` / `--dry-run` только у `clean`).

## Подкоманды

| Подкоманда | Назначение                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `list`     | Список зависимостей из lock                                                                        |
| `tree`     | Дерево зависимостей                                                                                |
| `why`      | Почему пакет в графе                                                                               |
| `clean`    | Wipe project modules (`apm_modules`), тот же wipe что `cache clean` — не shared APM git/http cache |

## Параметры

| Флаг           | Значение | Эффект                                                   | Default | Где     |
| -------------- | -------- | -------------------------------------------------------- | ------- | ------- |
| `--json`       | —        | Machine-readable why (success → stdout, errors → stderr) | off     | `why`   |
| `-y`, `--yes`  | —        | Подтвердить wipe modules                                 | off     | `clean` |
| `--dry-run`    | —        | Превью clean без удаления (`-y` не нужен)                | off     | `clean` |
| `--help`, `-h` | —        | Показать help                                            | —       | любая   |

### Примеры

```text
bapm deps why shared-utils
bapm deps why acme-org/shared-utils
bapm deps clean --dry-run
```

См. также: [find](/reference/find), [cache](/reference/cache).
