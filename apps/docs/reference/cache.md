# bapm cache — флаги

По `bapm cache --help`.

## Использование

```text
bapm cache info
bapm cache clean [-y|--yes] [--dry-run]
```

Работает с project modules-cache (`apm_modules`). Это **не** shared APM git/http cache. После `clean` снова `install` / `lock`, чтобы заполнить modules.

## Параметры

| Флаг           | Значение | Эффект                                    | Default | Где     |
| -------------- | -------- | ----------------------------------------- | ------- | ------- |
| `-y`, `--yes`  | —        | Подтвердить clean без prompt              | off     | `clean` |
| `--dry-run`    | —        | Превью clean без удаления (`-y` не нужен) | off     | `clean` |
| `--help`, `-h` | —        | Показать help                             | —       | любая   |

`--dry-run` на `info` отвергается. Wipe modules также: `bapm deps clean` ([deps](/reference/deps)).
