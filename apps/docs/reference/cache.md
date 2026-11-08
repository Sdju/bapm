# bapm cache — флаги

По `bapm cache --help`.

## Использование

```text
bapm cache info [--shared]
bapm cache clean [-y|--yes] [--dry-run] [--shared]
bapm cache prune --shared [--days N] [--dry-run] [--json] [-y]
```

Без `--shared` `info` / `clean` работают с project modules-cache (`apm_modules`). Это **не** shared git cache. После `clean` снова `install` / `lock`, чтобы заполнить modules.

`cache prune` устроен иначе: он **никогда** не удаляет `apm_modules`. Без `--shared` команда лишь напоминает, что project modules чистит `bapm prune`, и завершается с exit `0`. Реальное удаление shared mirrors требует `--shared`.

## Параметры

| Флаг           | Значение | Эффект                                                                   | Default | Где                      |
| -------------- | -------- | ------------------------------------------------------------------------ | ------- | ------------------------ |
| `-y`, `--yes`  | —        | Обязателен для `clean`; для `prune` не обязателен (принят для симметрии) | off     | `clean`, `prune`         |
| `--dry-run`    | —        | Превью clean/prune без удаления (`-y` не нужен)                          | off     | `clean`, `prune`         |
| `--shared`     | —        | Работать с opt-in shared git mirror cache вместо `apm_modules`           | off     | `info`, `clean`, `prune` |
| `--days N`     | целое ≥0 | Prune mirrors, не изменявшихся/не читавшихся N дней                      | `30`    | `prune`                  |
| `--json`       | —        | Стабильный JSON prune: `{pruned, failed, candidates, root}`              | off     | `prune`                  |
| `--help`, `-h` | —        | Показать help                                                            | —       | любая                    |

`--dry-run` на `info` отвергается, как и `--days` / `--json` на `info` и `clean`. Wipe modules также: `bapm deps clean` ([deps](/reference/deps)).

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

## Shared cache prune (opt-in)

```bash
bapm cache prune --shared                    # mirrors старше 30 дней
bapm cache prune --shared --days 7          # окно 7 дней
bapm cache prune --shared --dry-run         # список кандидатов, без удаления
bapm cache prune --shared --json            # стабильный машинный результат
```

- Кандидаты — только реальные директории bare mirrors прямо в `<BAPM_CACHE_DIR>/git`. Возраст считается по последнему `mtime`/`atime` директории mirror: max(mtime, atime).
- `--days` принимает только неотрицательное целое. `0` делает кандидатами все уже существующие mirrors; отрицательные и дробные значения отвергаются **до** любых удалений.
- Символические ссылки пропускаются и никогда не разыменовываются. Удаление выполняется по одному mirror; ошибка одного не останавливает остальные.
- `bapm cache prune` без `--shared` не удаляет ни shared mirrors, ни `apm_modules`: он только сообщает, что project modules обрабатывает `bapm prune`.
- Если `BAPM_CACHE_DIR` не задан, команда завершается с exit `0` и сообщением `shared cache not configured` (в `--json` — `root: null`).
- `--json` всегда печатает `{pruned, failed, candidates, root}`: `pruned`/`failed` — счётчики, `candidates` — имена mirrors относительно `root`, `root` — `<BAPM_CACHE_DIR>/git` или `null`.
- `pruned` считает только успешные удаления. При ошибках удаления команда продолжает, печатает failed-пути и завершается с exit `1`; успешные удаления не откатываются.
- HTTP cache и project `apm_modules` этой командой не затрагиваются. Lockfile не читается.
