# Lock-файл

Lock фиксирует разрешённый граф: commits, hashes, deploy-пути. Без него у команды и CI легко получить «у меня работает иначе».

Discovery — **только cwd** (без walk-up по родителям).

## Какие файлы и зачем

| Файл                               | Назначение                                                         | В git?                          |
| ---------------------------------- | ------------------------------------------------------------------ | ------------------------------- |
| `bapm.lock.yaml` / `apm.lock.yaml` | Shared: командные пины (git, registry, OpenAPM `path:`, …)         | Да, вместе с манифестом         |
| `bapm.local.lock.yaml`             | Personal: только пины от bapm-дискриминатора `local`               | Нет — в `.gitignore`            |
| `apm.local.lock.yaml`              | **Не поддерживается**                                              | Присутствие → fail-closed       |

Новый shared lock пишется как `bapm.lock.yaml`. Если уже есть только `apm.lock.yaml` — write-back в него. Оба shared сразу — ошибка `LOCKFILE_DUAL_CONFLICT`. Legacy `apm.lock` (без `.yaml`) игнорируется. Personal всегда только `bapm.local.lock.yaml`.

Сценарий «личный WIP без шума в team lock»: [личный local lock](/guide/situations/personal-local-lock). Overlay настроек (`bapm.local.yml`) — отдельно: [personal overlay](/guide/manifest-overlay).

## Partition: что куда попадает

Решает **форма зависимости в манифесте**, не строка `source:` в lock wire.

| Источник в манифесте                         | Куда уходит pin        |
| -------------------------------------------- | ---------------------- |
| Bapm `local` / `local: true` / `local: ./…`  | **Personal**           |
| OpenAPM `path:` (и path-like строки)         | **Shared**             |
| `git`, registry, marketplace, …              | **Shared**             |

Важно: у `path:` в lock часто тоже стоит `source: local` — это **не** personal-scope. В personal попадает только дискриминатор `local` (маркер scope на записи).

Inventory bags на shared-документе (имя не значит «личный файл»):

- `local_deployed_files` / `local_deployed_file_hashes`
- прочие top-level списки/карты inventory (MCP и т.п.)

Они остаются на shared даже при наличии personal lock.

## Чтение: effective graph

`resolve` / `install` / `lock` / `update` и проверки читают **объединение** shared ∪ personal в один effective graph:

1. Загружается shared (`bapm.lock.yaml` или `apm.lock.yaml`), если есть.
2. Загружается personal (`bapm.local.lock.yaml`), если есть.
3. Зависимости объединяются по identity (`repo_url`) / `name`.
4. Top-level bags берутся со **shared** (personal — в основном про `dependencies`).

Отсутствует personal, а в манифесте нет `local`-источников — нормально (типичный CI). Отсутствуют **оба** файла — для команд, которым нужен lock, это ошибка / missing lock.

Конфликт одного и того же пакета в обоих файлах с разным содержимым пина → `LOCKFILE_MERGE_CONFLICT` (fail-closed).

## Запись: dual-write

При успешном `bapm lock`, `bapm install` (не frozen rewrite) и `bapm update` bapm **делит** effective graph и пишет оба файла:

- shared — всё, кроме personal-scope строк;
- personal — только personal-scope.

| Ситуация                                      | Поведение                                              |
| --------------------------------------------- | ------------------------------------------------------ |
| Есть хотя бы один `local` в графе             | Создаётся / обновляется `bapm.local.lock.yaml`         |
| Personal-scope пуст                           | Personal **не** создаётся; устаревший файл **удаляется** |
| Убрали все `local` из манифеста               | Ghost-пины в personal очищаются (файл может исчезнуть) |

При записи personal bapm **дописывает** в `.gitignore` строку `bapm.local.lock.yaml`, если её ещё нет (по аналогии с игнором `.agents/local/`).

## Миграция legacy

Старые checkout'ы могли держать personal-scope строки **внутри shared** lock (маркер scope на записи).

- **Чтение** — такие строки по-прежнему видны в effective graph.
- **Следующая успешная запись** (`lock` / install / update) выносит их в `bapm.local.lock.yaml` и убирает из shared.

Ручной перенос не нужен: достаточно обычного lock/install.

## Gitignore, doctor, pack / publish

| Действие                         | Поведение                                                                 |
| -------------------------------- | ------------------------------------------------------------------------- |
| Запись personal                  | Ensure `.gitignore` покрывает `bapm.local.lock.yaml`                      |
| `bapm doctor`                    | Если файл уже **tracked** в git — WARN (не critical, exit 0 возможен)     |
| `bapm pack` / `bapm publish`     | Personal lock **опускают** (как `bapm.local.yml`)                         |

Если personal уже попал в индекс: `git rm --cached bapm.local.lock.yaml` и убедитесь, что он в `.gitignore`.

## CI и frozen

Коммитьте **shared** lock вместе с манифестом. **Не** коммитьте `bapm.local.lock.yaml`.

В CI при truthy env `CI` (не `""`, `"0"`, `"false"`) `install` по умолчанию **frozen**. Явный выход: `--no-frozen`. Frozen нельзя сочетать с `--update`.

| Что критично для frozen / CI      | Комментарий                                                         |
| --------------------------------- | ------------------------------------------------------------------- |
| Shared lock                       | Должен быть закоммичен; без любого lock — fail closed               |
| Personal lock                     | Не обязателен, если в манифесте **нет** `local`-источников          |
| `local` в командном манифесте     | Pin должен быть в effective graph (обычно в personal на машине dev) |

Типичный CI: закоммиченный shared + `bapm install --frozen` (или `install` при `CI=1`). Личный WIP на `local` лучше не класть в CI-критичный shared-манифест.

Сценарий: [CI / frozen](/guide/situations/ci-frozen).

## Когда появляется

```bash
bapm lock                      # resolve + lock, без deploy
bapm install --target cursor   # lock + modules + deploy
bapm update                    # переразрешить refs и переписать lock
```

| Действие           | Команда                            |
| ------------------ | ---------------------------------- |
| Только lock        | `bapm lock`                        |
| Lock + install     | `bapm install`                     |
| Без дрейфа пинов   | `bapm install --frozen`            |
| Переразрешить refs | `bapm update` / `install --update` |
| Только план        | `bapm update --dry-run`            |

`bapm lock` **не** принимает `--target`. Флаги: [lock](/reference/lock), [install](/reference/install).

## Что на диске рядом

| Артефакт                                  | Смысл                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `bapm.lock.yaml` / `apm.lock.yaml`        | Shared зафиксированный граф                                           |
| `bapm.local.lock.yaml`                    | Personal-пины `local` (gitignore)                                     |
| `apm_modules/`                            | Материализованные пакеты                                              |
| `deployed_files` / `deployed_file_hashes` | Атрибуция deploy; `--frozen` может сверить с диском                   |
| Deploy в Cursor                           | `.agents/skills/…`, `.cursor/…` — [быстрый старт](/guide/quick-start) |

## Частые ошибки

| Симптом / ошибка                         | Что сделать                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `LOCKFILE_DUAL_CONFLICT`                 | Оставьте один shared: `bapm.lock.yaml` **или** `apm.lock.yaml`, не оба      |
| `LOCKFILE_UNSUPPORTED_PERSONAL_BRAND`    | Удалите `apm.local.lock.yaml`; используйте только `bapm.local.lock.yaml`    |
| `LOCKFILE_MERGE_CONFLICT`                | Один пакет в shared и personal с разными пинами — выровняйте / переlock     |
| Doctor WARN: personal lock tracked       | `git rm --cached bapm.local.lock.yaml`, строка в `.gitignore`               |
| Frozen / CI без shared                   | Локально `bapm lock` или `install`, закоммитьте shared, снова CI            |
| Путаница `path:` vs `local`              | `path:` → shared; bapm `local` → personal ([зависимости](/guide/manifest-dependencies)) |

## Чего не делать

- Не править lock вручную — сломаете пины и hash-карты. Нужен другой pin → `update` / правка манифеста + install.
- Не держать оба имени shared lock-файла.
- Не коммитить `bapm.local.lock.yaml` и не путать его с shared.
- Не заводить `apm.local.lock.yaml`.
- Не путать `--force` с обновлением refs: force не refresh'ит mutable refs и не обходит frozen/policy.
- Positional package-ref add в frozen отклонён.

Манифест: [config](/guide/config-manifest). Overlay: [bapm.local.yml](/guide/manifest-overlay). Conformance: [conformance](/guide/conformance).
