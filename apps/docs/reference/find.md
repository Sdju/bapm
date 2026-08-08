# bapm find — флаги

По `bapm help find`.

## Использование

```text
bapm find PATH [options]
```

Offline: смотрит inventory lock (`deployed_file_hashes` / списки), сеть не нужна. `PATH` — относительный workspace-путь, который задеплоил установленный пакет.

## Параметры

| Флаг           | Значение | Эффект                                                   | Default |
| -------------- | -------- | -------------------------------------------------------- | ------- |
| `--source`     | —        | Добавить resolved origin (oci/git/local) к каждому owner | off     |
| `--path`       | —        | Печатать root-to-target why-chains (как `deps why`)      | off     |
| `--help`, `-h` | —        | Показать help                                            | —       |

## Коды выхода codes

| Код | Смысл                                  |
| --- | -------------------------------------- |
| `0` | Путь отслеживается в lock              |
| `1` | Lock читается, путь не tracked         |
| `2` | Нет / нечитаемый lock (`bapm install`) |

См. также: [deps](/reference/deps), [lockfile](/guide/lockfile).
