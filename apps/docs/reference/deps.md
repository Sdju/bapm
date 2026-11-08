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

### Семантика `deps why --json`

`package.is_direct` (и `paths[].chain[].is_direct`) равен `true`, когда запись lock имеет `depth: 1` или её точная идентичность объявлена в `dependencies.apm` / `devDependencies.apm` манифеста (строка, `alias`/`name`/`id`/`git`/`path`). Пустой или отсутствующий `resolved_by` сам по себе не означает прямую зависимость. Цепочка не включает псевдоузел корня проекта: для прямой зависимости `paths[].chain` содержит только её саму.

Если манифест отсутствует или не читается, используется консервативный fallback по lock: `depth: 1`, пустой `resolved_by` или цепочка `resolved_by`, состоящая только из корня проекта и самого пакета.

### Примеры

```text
bapm deps why shared-utils
bapm deps why acme-org/shared-utils
bapm deps clean --dry-run
```

См. также: [find](/reference/find), [cache](/reference/cache).
