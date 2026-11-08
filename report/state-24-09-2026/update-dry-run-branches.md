# `update --dry-run` показывает ветки как `keep`

**Статус:** открыто  
**Класс:** продукт / вводящий в заблуждение план  
**Важность:** средняя — план `--dry-run` скрывает изменения веток/тегов, а `update -y` их применяет.  
**Проверено:** 08-11-2026, working tree

## Суть

План `--dry-run` смотрит semver-constraint или выведенный `^major` из `resolved_tag`. У пакета на ветке (`#main`) constraint нет, `resolved_tag` тоже нет — только `resolved_ref`. В плане такой пакет получает `keep`, хотя apply резолвит git заново и сдвигает коммит.

Механизм: `planWithoutMutation` берёт `d.constraint`, иначе строит `^<major>.0.0` из `resolved_tag`, иначе `keep`. Apply идёт через `resolveAndLock({ updateRefs: true })`, который переразрешает literal ref и двигает пин. То есть dry-run и apply используют разные источники истины: первый — lock и semver, второй — сеть и ref.

Проблема шире веток: любой literal ref/тег и локальные записи в плане тоже `keep`. А без `-v` строки `keep` отфильтровываются, поэтому план из одних веток печатает «No dependency changes planned» — и это выглядит как отсутствие изменений, хотя `update -y` их сделает.

## Влияние

- **Сценарий:** `bapm update --dry-run` перед применением в проекте с зависимостями на ветках.
- **Кого задевает:** команда, CI-скрипты, которые читают план и решают, запускать ли update.
- **Последствие:** план говорит «изменений нет», apply меняет lock; решение принимается по неверному выводу.
- **Частота:** любая зависимость на ветке или literal-теге; распространённый сценарий.
- **Обходной путь:** `bapm outdated` (сравнивает tip ветки), `--dry-run -v` (покажет `keep`), либо смотреть lock после apply.

## Состояние

| Источник     | Позиция                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| APM          | `outdated` показывает drift ветки; plan update может отличаться от apply.                                                                                                |
| OpenAPM      | Mutable ref vs pinned commit — разные операции.                                                                                                                          |
| Спека bapm   | `lifecycle-update`:41-58 — dry-run и apply; :69-85 — keep-строки скрываются без verbose. Отдельного требования «план видит ветки» нет.                                   |
| Код bapm     | `packages/core/src/modules/Update/runUpdate.ts:45-49` — dry-run; `planWithoutMutation`:115-182; constraint/`resolved_tag` — :149-154; `keep` — :170-172; apply — :71-83. |
| Документация | `apps/docs/guide/situations/update-deps.md:25`: «пакеты на ветках помечены `keep`, хотя `update -y` их сдвинет»; :62 — та же оговорка.                                   |
| Тесты        | `packages/core/tests/lifecycle/update-plan-verbose.test.ts:29-80` — фильтрация keep на semver-фикстуре; кейса с веткой нет.                                              |

## Проверка

| Артефакт | Где смотреть                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Update/runUpdate.ts:149-154` — constraint из lock или `^major` из `resolved_tag`; для ветки оба пусты. |
| Код      | `packages/core/src/modules/Update/runUpdate.ts:170-172` — fallback `action: "keep"`; `:230-234` — без verbose keep не печатается. |
| Код      | `packages/core/src/modules/Update/runUpdate.ts:71-83` — apply вызывает `resolveAndLock` с `updateRefs: true`.                     |
| Тесты    | `packages/core/tests/lifecycle/update.test.ts:204-246` — dry-run не мутирует; `update-plan-verbose.test.ts` — только semver keep. |
| Спека    | `openspec/specs/lifecycle-update/spec.md:41-58` — dry-run; :69-85 — verbosity.                                                    |
| Docs     | `apps/docs/guide/situations/update-deps.md:25,62` — предупреждение про ветки.                                                     |

Воспроизведение:

```bash
# lock пинит ветку master на старый коммит; в удалённом master уже новый
bapm update --dry-run;            # "No dependency changes planned"
bapm update --dry-run -v;         # "[=] dep keep"
bapm update -y;                   # "[~] dep: old → new", lock сдвинут
```

Ожидание: dry-run показывает, что ветка сдвинется.  
Факт: план `keep`/пустой, apply двигает коммит.

## Вариации

1. Dry-run резолвит ветки так же, как apply. — рекомендуется, если допустима сеть
2. Dry-run только semver (текущее) — план врёт про ветки.
3. Печатать отдельную строку «branch: unknown until apply». — если dry-run должен остаться офлайн

## Рекомендация

Вариант 1: в `planWithoutMutation` для literal ref вызывать `gitRemote.resolveRef` и сравнивать tip с `resolved_commit`; `update` уже ходит в сеть, поэтому dry-run не станет принципиально дороже. Если dry-run обязан оставаться офлайн — вариант 3 с явной строкой «branch: unknown until apply». Оценка S/M: S — добавить literal-ветку в план; M — тесты на ветки/теги и docs.

Критерии закрытия:

- [ ] `update --dry-run` показывает `update` для ветки, если tip ушёл от пина.
- [ ] без verbose не остаётся ложного «No dependency changes planned» при изменениях веток.
- [ ] тест с веткой и docs обновлены.

## Поведение сейчас

Полная картина — `bapm outdated`. `--dry-run` без `-v` ещё и прячет строки `keep`, поэтому ветки могут не попасть в вывод вовсе. `update -y` затем резолвит ветку и пишет новый коммит.

## Связанные

- [update-not-blocked-in-ci.md](./update-not-blocked-in-ci.md) — update в CI применяет план без запрета.
