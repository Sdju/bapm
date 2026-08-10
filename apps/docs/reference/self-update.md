# bapm self-update — флаги

По `bapm self-update --help`.

## Использование

```text
bapm self-update [--check]
```

Сравнивает / обновляет CLI относительно npm metadata. Неизвестные флаги отвергаются.

## Параметры

| Флаг           | Значение | Эффект                                                         | Default |
| -------------- | -------- | -------------------------------------------------------------- | ------- |
| `--check`      | —        | Сравнить running version с npm dist-tag `latest` (без upgrade) | off     |
| `--help`, `-h` | —        | Показать help                                                  | —       |

## Коды выхода (`--check`)

| Код | Смысл                                              |
| --- | -------------------------------------------------- |
| `0` | up-to-date                                         |
| `1` | update available, unknown version или check failed |

Без `--check` CLI пытается global upgrade через npm (`npm i -g @b-apm/cli@…`), если не задан `BAPM_SELF_UPDATE_DISABLE=1`.

## Оговорка про npm

::: warning UNSTABLE
Пакет `@b-apm/cli` опубликован на npm (первый релиз **0.1.0**), но релиз ранний: API и поведение могут меняться без major bump. Для проверки обновления без установки предпочитайте `bapm self-update --check`. Установка: [Быстрый старт](/guide/quick-start).
:::
