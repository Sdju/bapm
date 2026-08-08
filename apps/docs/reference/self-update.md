# bapm self-update — флаги

По `bapm help self-update`.

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

Без `--check` CLI пытается global upgrade через npm (`npm i -g @bapm/cli@…`), если не задан `BAPM_SELF_UPDATE_DISABLE=1`.

## Оговорка про npm

Публикация scoped-пакета `@bapm/cli` ещё может быть нестабильной. Не полагайтесь на `npm i -g @bapm/cli` / `self-update` без `--check`, пока пользовательский publish path не зафиксирован. Установка в проект: [Быстрый старт](/guide/quick-start).
