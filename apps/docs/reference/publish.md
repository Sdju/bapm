# bapm publish — флаги

По `bapm publish --help`.

## Использование

```text
bapm publish [options]
```

Experimental PUT flat registry zip. Требует `BAPM_EXPERIMENTAL_REGISTRIES=1`. Для защищённых registry — `BAPM_REGISTRY_TOKEN` (Bearer). Layout архива: `apm.yml` + `.apm/` в корне zip (отдельно от `bapm pack`). Неизвестные флаги отвергаются.

Тот же корневой `.bapmignore`, что и у [pack](/reference/pack): может опустить optional docs (`README.md`, `CHANGELOG.md`, …) и отдельные файлы под `.apm/`. Wire `apm.yml` всегда пишется из base-манифеста. Если после ignore в `.apm/` не осталось файлов — publish fail closed. `--zip` загружает готовый archive **без** повторного применения `.bapmignore`. `.gitignore` не используется как fallback.

## Параметры

| Флаг           | Значение | Эффект                                  | Default |
| -------------- | -------- | --------------------------------------- | ------- |
| `--dry-run`    | —        | Build/validate без PUT                  | off     |
| `--zip`        | `<path>` | Загрузить готовый archive (без rebuild) | —       |
| `--help`, `-h` | —        | Показать help                           | —       |

Архив **не** включает `bapm.local.yml` и `bapm.local.lock.yaml` (как pack).

См. также: [pack](/reference/pack) (`.bapmignore`, producer zip / marketplace.json), [lock-файл](/guide/lockfile), карта [команд](/guide/commands).
