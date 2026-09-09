# bapm publish — флаги

По `bapm publish --help`.

## Использование

```text
bapm publish [options]
```

Experimental PUT flat registry zip. Требует `BAPM_EXPERIMENTAL_REGISTRIES=1`. Для защищённых registry — `BAPM_REGISTRY_TOKEN` (Bearer). Layout архива: `apm.yml` + `.apm/` в корне zip (отдельно от `bapm pack`). Неизвестные флаги отвергаются.

## Параметры

| Флаг           | Значение | Эффект                                  | Default |
| -------------- | -------- | --------------------------------------- | ------- |
| `--dry-run`    | —        | Build/validate без PUT                  | off     |
| `--zip`        | `<path>` | Загрузить готовый archive (без rebuild) | —       |
| `--help`, `-h` | —        | Показать help                           | —       |

Архив **не** включает `bapm.local.yml` и `bapm.local.lock.yaml` (как pack).

См. также: [pack](/reference/pack) (producer zip / marketplace.json), [lock-файл](/guide/lockfile), карта [команд](/guide/commands).
