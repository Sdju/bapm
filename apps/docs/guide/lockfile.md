# Lockfile

Lockfile фиксирует разрешённый граф зависимостей: какие refs во что схлопнулись (commits, hashes, deploy-пути). Без него у команды и CI легко получить «у меня работает иначе».

Discovery — **только cwd**, без walk-up по родителям.

## Dual-read имён

| Файл | Когда |
| --- | --- |
| `bapm.lock.yaml` | Брендинг bapm; **новый** lock при отсутствии существующего пишется сюда |
| `apm.lock.yaml` | Dual-read / OpenAPM-совместимое имя; если он уже есть — write-back в него |

Как у манифеста: ровно один из двух. Оба сразу — `LOCKFILE_DUAL_CONFLICT` (refuse to merge). Legacy `apm.lock` (без `.yaml`) при discovery **игнорируется**.

## Когда появляется и обновляется

| Действие | Команда | Что на диске |
| --- | --- | --- |
| Resolve + запись lock **без** host deploy | `bapm lock` | Обновляет/создаёт `*.lock.yaml`; не материализует Cursor |
| Resolve + lock + modules + (при target) deploy | `bapm install` | Lock + `apm_modules/` + файлы хоста |
| Не менять пины / дрейф | `bapm install --frozen` | Требует существующий lock; fail при отсутствии или drift; при наличии — re-verify `deployed_file_hashes` |
| Переразрешить mutable refs | `bapm install --update` или `bapm update` (с confirm / `-y`) | Новые пины в lock |
| Только план update | `bapm update --dry-run` | Lock не меняется |

`bapm lock` **не** принимает `--target`: это resolve + lockfile без host materialize. Deploy — через `install` (часто с `--target cursor`).

Флаги: [install](/reference/install), [lock](/reference/lock), [update](/reference/update).

## Commit в git и CI

Коммитьте lock **вместе с манифестом**, если нужна воспроизводимость у команды и в CI.

В CI, когда env `CI` truthy (не `""`, `"0"`, `"false"`), `bapm install` по умолчанию ведёт себя как **frozen** (OpenAPM req-lk-018). Чтобы разрешить дрейф пинов в таком окружении — явный `--no-frozen`. Frozen (явный или CI-default) нельзя сочетать с `--update`.

Типичный CI-flow: закоммиченный lock + `bapm install --frozen` (или просто `install` при truthy `CI`).

## Что не делать

- Не править lock вручную «чтобы побыстрее» — легко сломать пины, `tree_sha256` и hash-карты deploy. Нужен другой pin → `install --update` / `update` / правка манифеста + обычный install.
- Не держать оба `apm.lock.yaml` и `bapm.lock.yaml`.
- Не удалять lock локально и ждать стабильный CI без перегенерации и commit.
- Не путать `--force` с обновлением refs: force не refresh'ит mutable refs и не обходит frozen/policy.
- Positional package-ref add в frozen-режиме отклонён — сначала выйдите из frozen (`--no-frozen` вне строгого CI) или обновите манифест иначе.

## Что увидите рядом на диске

После успешного `install` (happy path):

| Артефакт | Смысл для пользователя |
| --- | --- |
| `bapm.lock.yaml` или `apm.lock.yaml` | Зафиксированный граф: resolved commits/refs, списки зависимостей |
| `apm_modules/` | Дерево/кэш материализованных пакетов (имя каталога — wire-parity с APM; не `bapm_modules`) |
| Записи в lock вроде `deployed_files` / `deployed_file_hashes` | Какие файлы хоста атрибутированы пакету и с каким содержимым; `--frozen` может сверить их с диском |
| `local_deployed_file_hashes` | Hash-карта путей без чёткого package-owner (если такие появились) |
| Deploy в Cursor | `.agents/skills/…`, `.cursor/rules/…`, `.cursor/agents/…`, `.cursor/mcp.json` — см. [Быстрый старт](/guide/quick-start) |

`bapm lock` обновит lock и modules-resolve path без записи в Cursor. `bapm find` / `bapm deps` опираются на inventory из lock (в т.ч. deployed hashes).

Формальная schema dump здесь не дублируется: смотрите свой `*.lock.yaml` и при необходимости [conformance](/guide/conformance). Манифест: [config](/guide/config-manifest).
