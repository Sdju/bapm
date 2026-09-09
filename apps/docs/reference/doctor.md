# bapm doctor — флаги

По `bapm doctor --help`.

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

## WARN (не critical)

Если `bapm.local.yml` или `bapm.local.lock.yaml` уже **tracked** в git — предупреждение (exit может остаться 0). Снимите с индекса: `git rm --cached <файл>` и добавьте в `.gitignore`. См. [lock-файл](/guide/lockfile), [overlay](/guide/manifest-overlay).

См. также: [audit](/reference/audit), [US-07 Doctor / audit / prune](/guide/situations/doctor-audit-prune).
