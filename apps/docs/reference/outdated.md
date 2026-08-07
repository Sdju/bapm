# bapm outdated — флаги

По `bapm help outdated`.

## Использование

```text
bapm outdated [options]
```

Report-only: не меняет lockfile, modules cache и project files. Exit `0` даже при наличии outdated-строк. Отсутствующий lock → non-zero.

## Параметры

| Флаг | Значение | Эффект | Default |
| --- | --- | --- | --- |
| `-v`, `--verbose` | — | Богаче detail (chosen tip ref, skip reasons, candidates) | off |
| `-j`, `--parallel-checks` | `<n>` | Параллельные remote checks; `0` = serial | `4` |
| `--json` | — | Machine-readable список `{ "dependencies": [...] }` вместо human table | off |
| `-h`, `--help` | — | Показать help | — |

## Как проверяются пины

- branch / tag / abbreviated SHA — tip-of-ref
- semver constraints — highest satisfying tag
- полный 40-hex SHA — сравнение с latest annotated semver tag (только отчёт; манифест не переписывается)

Чтобы переразрешить и записать пины: [update](/reference/update). Сценарий: [US-03](/guide/situations/update-deps).
