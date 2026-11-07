# bapm init — флаги

По `bapm init --help`.

## Использование

```text
bapm init [options] [project-name]
```

Пишет только `bapm.yml`. Отказывается, если уже есть `apm.yml` или `bapm.yml`. Неизвестные флаги отвергаются. Scaffold plugin / marketplace в эту команду не входит.

## Параметры

| Флаг           | Значение | Эффект                                                     | Default |
| -------------- | -------- | ---------------------------------------------------------- | ------- |
| `-y`, `--yes`  | —        | Non-interactive defaults (`version: 0.1.0`)                | off     |
| `--target`     | `<id>`   | Записать агента в `active` и `targets` (например `cursor`) | —       |
| `--help`, `-h` | —        | Показать help                                              | —       |

Позиционный `project-name` задаёт `name` (иначе — имя каталога).

Пример результата: [Быстрый старт](/guide/quick-start#init). Манифест: [bapm.yml](/guide/config-manifest).
