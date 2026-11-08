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
| `-v`, `--verbose`      | —        | Показать keep/`[=]` строки и note в плане | off       |
| `--parallel-downloads` | `<n>`    | Параллельные загрузки; `0` = serial       | `4`       |
| `--policy`             | `<path>` | Явный policy-файл                         | discovery |
| `--no-policy`          | —        | Пропустить policy discovery/checks        | off       |
| `--help`, `-h`         | —        | Показать help                             | —         |

Positionals — опциональный список пакетов для ограниченного update. Неизвестные флаги отвергаются.

`--dry-run` не меняет lock и `apm_modules`. Для semver-диапазонов план подбирает теги, а для веток и literal-тегов резолвит `resolved_ref` через `git ls-remote` и сравнивает tip с закреплённым коммитом — так же, как это сделает `update -y`. Если ref не удаётся резолвить (например, нет сети), запись остаётся `keep` с пояснением; note печатается с `-v`.

См. также: [outdated](/reference/outdated), [lock](/reference/lock), [Обновить зависимости](/guide/situations/update-deps).
