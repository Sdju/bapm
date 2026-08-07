# bapm init — флаги

По `bapm help init`.

## Использование

```text
bapm init [options] [project-name]
```

Пишет только `bapm.yml`. Отказывается, если уже есть `apm.yml` или `bapm.yml`. Неизвестные флаги отвергаются. Scaffold plugin / marketplace в эту команду не входит.

## Параметры

| Флаг | Значение | Эффект | Default |
| --- | --- | --- | --- |
| `-y`, `--yes` | — | Non-interactive defaults (`version: 0.1.0`) | off |
| `--target` | `<id>` | Записать host target в манифест (например `cursor`) | — |
| `--help`, `-h` | — | Показать help | — |

Позиционный `project-name` задаёт `name` (иначе — имя каталога).

Сценарий: [US-01 Свежий install](/guide/situations/install-fresh). Манифест: [config](/guide/config-manifest).
