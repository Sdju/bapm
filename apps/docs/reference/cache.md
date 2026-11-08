# bapm cache — флаги

По `bapm cache --help`.

## Использование

```text
bapm cache info [--shared]
bapm cache clean [-y|--yes] [--dry-run] [--shared]
```

Без `--shared` работает с project modules-cache (`apm_modules`). Это **не** shared git cache. После `clean` снова `install` / `lock`, чтобы заполнить modules.

## Параметры

| Флаг           | Значение | Эффект                                                                    | Default | Где             |
| -------------- | -------- | ------------------------------------------------------------------------- | ------- | --------------- |
| `-y`, `--yes`  | —        | Обязателен для удаления: без него `clean` отказывается, вопроса не задаёт | off     | `clean`         |
| `--dry-run`    | —        | Превью clean без удаления (`-y` не нужен)                                 | off     | `clean`         |
| `--shared`     | —        | Работать с opt-in shared git mirror cache вместо `apm_modules`            | off     | `info`, `clean` |
| `--help`, `-h` | —        | Показать help                                                             | —       | любая           |

`--dry-run` на `info` отвергается. Wipe modules также: `bapm deps clean` ([deps](/reference/deps)).

## Shared git cache (opt-in)

Shared cache выключен по умолчанию: без переменных окружения install делает обычный clone в `apm_modules`.

| Переменная        | Эффект                                                                      |
| ----------------- | --------------------------------------------------------------------------- |
| `BAPM_CACHE_DIR`  | Включает shared cache с корнем в этом каталоге. Не задана — cache выключен. |
| `BAPM_NO_CACHE=1` | Отключает использование cache, даже если `BAPM_CACHE_DIR` задан.            |

Layout:

```text
<BAPM_CACHE_DIR>/git/<sha256(normalized repo url)>.git   # bare mirror
```

- Ключ — нормализованный repo identity (host case, `.git`, path case для disclosed case-insensitive host), не ref/commit. Один mirror обслуживает все refs одного репозитория.
- Local `path`, `file://` и `local:` источники **никогда** не попадают в shared cache.
- При cache-ошибке downloader печатает `bapm: warning: …` и откатывается на прямой clone. Если `remote update` не удался, но нужный commit уже есть в mirror (offline), используется существующий mirror.
- Cache keys/materialization directories остаются раздельными по rs-016; shared cache не меняет identity isolation `apm_modules`.

`bapm cache info` (без `--shared`) показывает и project modules-cache, и, если `BAPM_CACHE_DIR` задан, размер/путь/число shared mirrors. `bapm cache info --shared` показывает только shared cache.

`bapm cache clean --shared -y` удаляет только bare mirrors под `<BAPM_CACHE_DIR>/git` и **не трогает** `apm_modules`. Обычный `bapm cache clean -y` не удаляет shared cache.
