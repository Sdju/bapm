# bapm doctor — флаги

По `bapm help doctor`.

## Использование

```text
bapm doctor [options]
```

Sanity checks окружения и проекта. Неизвестные флаги отвергаются.

## Параметры

| Флаг              | Значение | Эффект                                                   | Default |
| ----------------- | -------- | -------------------------------------------------------- | ------- |
| `-v`, `--verbose` | —        | Богаче domain detail; thin network probe (informational) | off     |
| `-h`, `--help`    | —        | Показать help                                            | —       |

## Informational checks

| Область | Поведение                                                                 |
| ------- | ------------------------------------------------------------------------- |
| auth    | Есть ли `GITHUB_TOKEN` / `GH_TOKEN` (только имена переменных, не секреты) |
| network | С `-v`: `git ls-remote` probe (никогда не critical)                       |

См. также: [audit](/reference/audit), [US-07 Doctor / audit / prune](/guide/situations/doctor-audit-prune).
