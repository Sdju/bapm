# Zip больше не заменяет каталог целиком

**Статус:** исправлено (working tree, change `fix-install-safety`)  
**Класс:** баг → намеренное отличие от «replace»  
**Важность:** низкая (закрыто; исторически критично) — установка zip удаляла каталог проекта вместе с `.git`, то есть молча теряла пользовательские файлы.  
**Проверено:** 08-11-2026, working tree

## Суть

Раньше `bapm install ./pack.zip` удалял текущий каталог (включая `.git`) и подставлял архив. Спека и APM ближе к «положить артефакт в проект», не «rm -rf .».

Исправление добавило второй режим safe-extract — `merge`: он пишет только членов архива, а при совпадении пути с другим содержимым падает до первой записи. Режим `replace` остался по умолчанию и применяется к registry materialize, где `dest` — кэш, которым владеет bapm.

Merge включается только для positional `.zip` в `install`. Конфликтом считаются symlink на любом сегменте пути, файл там, где нужен каталог, нерегулярный файл и файл с другим размером/байтами. Идентичные байты конфликтом не считаются.

## Влияние

- **Сценарий:** `bapm install ./pkg.zip` в существующем репозитории с `.git`, `README` и незакоммиченными правками.
- **Кого задевает:** новичок, ставящий pack в текущий каталог; команда, если архив ставили поверх рабочей копии.
- **Последствие:** раньше безвозвратно удалялись `.git` и файлы вне архива; теперь они остаются, а несовместимый `bapm.yml` даёт отказ до любой записи.
- **Частота:** каждый install из zip; destructive-эффект — до первого конфликта.
- **Обходной путь:** не нужен; документация по-прежнему советует ставить в пустой каталог ради предсказуемости.

## Состояние

| Источник     | Позиция                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Install из archive не принят как уничтожение git-дерева; типично распаковка в cwd.                                                            |
| OpenAPM      | Pack zip — контейнер файлов пакета; consumer extract не обязан replace root.                                                                  |
| Спека bapm   | `install-pipeline` (ранее delta): merge; конфликт содержимого — fail closed до записи. Registry materialize по-прежнему `replace`.            |
| Код bapm     | `Pack/safeExtract.ts` `mode: "merge"` из `extract.ts`. Конфликт: symlink, файл вместо dir, разный контент. Флаг `wx`, откат созданных файлов. |
| Тесты        | `tests/pack/archive-merge.test.ts`, `tests/pack/safe-extract-merge.test.ts`, `safe-extract-replace-compat.test.ts`.                           |
| Документация | `reference/install.md`, `pack.md`: merge + `Refusing to overwrite existing files`.                                                            |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Код      | `packages/core/src/modules/Pack/extract.ts:39` — `safeExtractZip(..., { mode: "merge" })` для install-from-archive. |
| Код      | `packages/core/src/modules/Pack/safeExtract.ts:516` — `mergeMembers`; `:522` — все конфликты до записи; `:459` — `flag: "wx"`. |
| Код      | `packages/core/src/modules/Registry/resolveHelpers.ts:128` — registry зовёт `safeExtractZip` без mode, то есть replace. |
| Тесты    | `packages/core/tests/pack/archive-merge.test.ts:47` — `.git` и посторонние файлы целы; `:68` — конфликт до записи; `:81` — идентичные байты не конфликт. |
| Тесты    | `packages/core/tests/pack/safe-extract-merge.test.ts:99` — конфликт последним членом ничего не пишет; `:143` — откат созданных файлов и каталогов. |
| Тесты    | `packages/core/tests/pack/safe-extract-replace-compat.test.ts:25` — replace-режим не изменился. |
| Спека    | `openspec/specs/install-pipeline/spec.md:244` — additive extract и fail closed на отличающихся байтах. |
| Спека    | `openspec/specs/archive-safe-extract/spec.md:48` — caps 10 000 entries / 100 MB до записи (общий pre-scan). |
| Docs     | `apps/docs/reference/install.md:57`, `apps/docs/reference/pack.md:44` — merge и отказ при другом содержимом. |

Воспроизведение:

```bash
pnpm -C packages/core test tests/pack/archive-merge.test.ts tests/pack/safe-extract-merge.test.ts tests/pack/safe-extract-replace-compat.test.ts
```

Ожидание: все тесты зелёные; при конфликте `bapm.yml` каталог не меняется.  
Факт: на текущем дереве проходит (13 тестов в трёх файлах).

## Вариации

1. Replace каталога (старое, опасно).
2. Merge + fail on conflict (текущее, **рекомендуется**).
3. Merge + `--force` перезаписывает — `--force` всё ещё no-op, см. [install-force-noop.md](./install-force-noop.md).

## Рекомендация

Оставить merge единственным режимом install-from-archive и не связывать его с `--force`, пока у флага нет семантики. Перезапись по `--force` — отдельное решение с риском потери данных. S.

Критерии закрытия:

- [x] merge не удаляет файлы вне архива;
- [x] конфликт содержимого падает до записи;
- [x] registry replace не регрессировал;
- [x] спека и docs описывают поведение.

## Поведение сейчас

`.git` и посторонние файлы остаются. Повторная установка того же zip в каталог с тем же `bapm.yml` проходит, если байты совпали; другой `bapm.yml` — отказ. Staging для merge не используется: запись идёт в целевой каталог с откатом созданного; staging в parent остался только у replace (registry).

## Связанные

- [install-force-noop.md](./install-force-noop.md) — `--force` не даёт обхода конфликта.
- [orphan-files-cleanup.md](./orphan-files-cleanup.md) — обратная задача: удаление файлов, которых больше нет в манифесте.
- [git-clone-idempotent.md](./git-clone-idempotent.md) — второе исправление того же change.
