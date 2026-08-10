# bapm update — флаги

По `bapm update --help`.

## Использование

```text
bapm update [packages...] [options]
```

Без `-y` / `--yes` при интерактивном TTY запрашивает подтверждение `Apply? [y/N]`. Без TTY confirm не проходит (нужен `-y` или `--dry-run`).

## Параметры

| Флаг                   | Значение | Эффект                                    | Default   |
| ---------------------- | -------- | ----------------------------------------- | --------- |
| `-y`, `--yes`          | —        | Применить без интерактивного confirm      | off       |
| `--dry-run`            | —        | Только план; не менять lock/modules       | off       |
| `-v`, `--verbose`      | —        | Включить keep/`[=]` строки в тексте плана | off       |
| `--parallel-downloads` | `<n>`    | Параллельные загрузки; `0` = serial       | `4`       |
| `--policy`             | `<path>` | Явный policy-файл                         | discovery |
| `--no-policy`          | —        | Пропустить policy discovery/checks        | off       |
| `--help`, `-h`         | —        | Показать help                             | —         |

Positionals — опциональный список пакетов для ограниченного update. Неизвестные флаги отвергаются.

См. также: [outdated](/reference/outdated), [lock](/reference/lock), [US-03 Update deps](/guide/situations/update-deps).
