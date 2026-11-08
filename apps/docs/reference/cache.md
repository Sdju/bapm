# bapm cache — флаги

По `bapm cache --help`.

## Использование

```text
bapm cache info [--shared]
bapm cache clean [-y|--yes] [--dry-run] [--shared]
bapm cache prune --shared [--days N] [--dry-run] [--json] [-y]
```

Без `--shared` `info` / `clean` работают с project modules-cache (`apm_modules`). Это **не** shared cache. После `clean` снова `install` / `lock`, чтобы заполнить modules.

`cache prune` устроен иначе: он **никогда** не удаляет `apm_modules`. Без `--shared` команда лишь напоминает, что project modules чистит `bapm prune`, и завершается с exit `0`. Реальное удаление shared-кэшей (git mirrors и HTTP entries) требует `--shared`.

## Параметры

| Флаг           | Значение | Эффект                                                                   | Default | Где                      |
| -------------- | -------- | ------------------------------------------------------------------------ | ------- | ------------------------ |
| `-y`, `--yes`  | —        | Обязателен для `clean`; для `prune` не обязателен (принят для симметрии) | off     | `clean`, `prune`         |
| `--dry-run`    | —        | Превью clean/prune без удаления (`-y` не нужен)                          | off     | `clean`, `prune`         |
| `--shared`     | —        | Работать с opt-in shared git + HTTP cache вместо `apm_modules`           | off     | `info`, `clean`, `prune` |
| `--days N`     | целое ≥0 | Prune mirrors/HTTP entries, не изменявшихся/не читавшихся N дней         | `30`    | `prune`                  |
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

`bapm cache info` (без `--shared`) показывает и project modules-cache, и, если `BAPM_CACHE_DIR` задан, размер/путь/число shared mirrors и HTTP entries. `bapm cache info --shared` показывает только shared cache (git + HTTP).

`bapm cache clean --shared -y` удаляет bare mirrors под `<BAPM_CACHE_DIR>/git` и HTTP entries под `<BAPM_CACHE_DIR>/http`, **не трогая** `apm_modules`. Обычный `bapm cache clean -y` не удаляет shared cache.

## Shared HTTP cache (opt-in)

HTTP-кэш включается тем же `BAPM_CACHE_DIR` и по умолчанию активен для registry GET, если не выключен явно:

| Переменная            | Эффект                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `BAPM_CACHE_DIR`      | Включает shared root. Не задана — HTTP-кэш выключен.                                      |
| `BAPM_NO_CACHE=1`     | Полностью отключает shared cache (git и HTTP).                                            |
| `BAPM_HTTP_CACHE=0`   | Отключает только HTTP-кэш; git mirror продолжает работать (также `false` / `no` / `off`). |
| `BAPM_HTTP_CACHE_TTL` | Свежесть entry в секундах (целое ≥0, default `300`). `0` означает, что hit невозможен.    |

Layout:

```text
<BAPM_CACHE_DIR>/http/<sha256(url + canonical request headers)>
```

- Ключ — URL плюс request headers: имена приведены к нижнему регистру и отсортированы, значения сохранены. Один и тот же GET с другим набором headers — другой entry.
- Кэшируются только идемпотентные `GET` с ответом `200`. Ответы `4xx`/`5xx`, `POST`/`PUT`/`PATCH`/`DELETE` и запросы с `Authorization` / `Cookie` (а также `Proxy-Authorization` / `Private-Token`) не читаются и не пишутся.
- Redirect-safe поведение registry transport сохраняется: redirects по-прежнему следуются вручную с drop Authorization на cross-class Location. Если после redirect получен `200`, он сохраняется под **исходным** URL и только когда исходный запрос безопасен для кэширования.
- На hit возвращаются сохранённые status/headers/body без сетевого запроса. На miss выполняется обычный fetch и запись. Ошибки чтения/записи кэша (битый файл, нет прав) не ломают запрос — transport откатывается на сеть.
- TTL считается от `fetchedAt` entry; истёкшие entries остаются на диске до `cache prune`.

## Shared cache prune (opt-in)

```bash
bapm cache prune --shared                    # mirrors старше 30 дней
bapm cache prune --shared --days 7          # окно 7 дней
bapm cache prune --shared --dry-run         # список кандидатов, без удаления
bapm cache prune --shared --json            # стабильный машинный результат
```

- Кандидаты — реальные директории bare mirrors прямо в `<BAPM_CACHE_DIR>/git` и entry-файлы под `<BAPM_CACHE_DIR>/http`. Возраст считается по последнему `mtime`/`atime` mirror/entry: max(mtime, atime).
- `--days` принимает только неотрицательное целое. `0` делает кандидатами все уже существующие mirrors/HTTP entries; отрицательные и дробные значения отвергаются **до** любых удалений.
- Символические ссылки пропускаются и никогда не разыменовываются. Удаление выполняется по одному mirror/entry; ошибка одного не останавливает остальные.
- `bapm cache prune` без `--shared` не удаляет ни shared mirrors, ни `apm_modules`: он только сообщает, что project modules обрабатывает `bapm prune`.
- Если `BAPM_CACHE_DIR` не задан, команда завершается с exit `0` и сообщением `shared cache not configured` (в `--json` — `root: null`).
- `--json` всегда печатает `{pruned, failed, candidates, root}`: `pruned`/`failed` — суммарные счётчики по git и HTTP; git-candidates — имена mirrors, HTTP-candidates — `http/<entry>`; `root` — `<BAPM_CACHE_DIR>/git` для git-only результата, `<BAPM_CACHE_DIR>` при наличии HTTP candidates, иначе `null`.
- `pruned` считает только успешные удаления. При ошибках удаления команда продолжает, печатает failed-пути и завершается с exit `1`; успешные удаления не откатываются.
- Project `apm_modules` этой командой не затрагивается. Lockfile не читается.
