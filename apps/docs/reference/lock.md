# bapm lock — флаги

По `bapm help lock`.

## Использование

```text
bapm lock [options]
bapm lock export [options]
```

Неизвестные флаги и неожиданные positionals отвергаются. `--target` у `lock` нет — это resolve + lockfile без host deploy.

## Параметры

| Флаг | Значение | Эффект | Default |
| --- | --- | --- | --- |
| `--update` | — | Переразрешить mutable refs | off |
| `-v`, `--verbose` | — | Подробный вывод | off |
| `--parallel-downloads` | `<n>` | Параллельные загрузки; `0` = serial | `4` |
| `--policy` | `<path>` | Явный policy-файл | discovery |
| `--no-policy` | — | Пропустить policy discovery/checks | off |
| `--help`, `-h` | — | Показать help | — |

## lock export

Read-only SBOM из существующего lockfile (без resolve/deploy).

```text
bapm lock export [-f|--format cyclonedx|spdx] [-o|--output <file>] [--timestamp <iso>]
```

| Флаг | Значение | Эффект | Default |
| --- | --- | --- | --- |
| `-f`, `--format` | `cyclonedx` \| `spdx` | Формат SBOM | `cyclonedx` |
| `-o`, `--output` | `<file>` | Путь записи | stdout / поведение core |
| `--timestamp` | `<iso>` | Явная метка времени в отчёте | — |
| `--help`, `-h` | — | Показать help lock | — |

Связанные команды: [install](/reference/install), [update](/reference/update), [Lockfile](/guide/lockfile).
