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

| Область | Поведение                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth    | Есть ли `GITHUB_TOKEN` / `GH_TOKEN` (только имена переменных, не секреты)                                                                         |
| network | С `-v`: `git ls-remote https://github.com/git/git.git` (никогда не critical). Доступ к вашему git-серверу, если это не github.com, не проверяется |

## Закоммиченные личные файлы

Если `bapm.local.yml` или `bapm.local.lock.yaml` уже **tracked** в git, doctor выводит строку `local-overlay` / `local-lock` с текстом `… is git-tracked`. Строка помечена `PASS` и на код выхода не влияет, поэтому ищите её в выводе глазами. Снимите файл с индекса: `git rm --cached <файл>` и добавьте в `.gitignore`. См. [lock-файл](/guide/lockfile), [overlay](/guide/manifest-overlay).

См. также: [audit](/reference/audit), [Что-то сломалось](/guide/situations/doctor-audit-prune).
