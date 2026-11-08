# `update -y` в CI не запрещён

**Статус:** открыто  
**Класс:** продукт / дыра в CI-гейте  
**Важность:** высокая — `update -y` в CI переписывает lock без явного opt-in, обходя frozen-дисциплину.  
**Проверено:** 08-11-2026, working tree

## Суть

`install` в CI сам включает frozen и отказывается от `--update`. Команда `bapm update` смотрит только на явный `options.frozen`. CLI это поле из `CI` не выставляет: в `packages/cli/src/modules/Update/services/runUpdate.ts` нет ни чтения `CI`, ни вызова `resolveEffectiveFrozen`, ни передачи `frozen`. В пайплайне `CI=true bapm update -y` применяет план и переписывает lock.

Спека требует большего: `lifecycle-update`:20 говорит, что update в frozen-контексте без явного override MUST отказать с ненулевым результатом. Но «frozen-контекст» для update нигде не вычисляется: `resolveEffectiveFrozen` есть в core и используется только install CLI. То есть это не только предупреждение в docs, а расхождение спеки и CLI.

`update` — мутирующая команда: она двигает пины, затем вызывает `runInstall` с `frozen: false`. Если CI-job запускает update (по ошибке, из старого скрипта или «чтобы обновить зависимости»), проверка lock перестаёт что-либо гарантировать: версии меняются без ревью, а job завершается успешно.

## Влияние

- **Сценарий:** CI с `CI=true` и шагом `bapm update -y` (явным или оставшимся от локального сценария).
- **Кого задевает:** CI, команда, безопасность цепочки поставок.
- **Последствие:** lock переписан в CI, пины уехали на новые коммиты/теги, ревью lock обойдено; exit `0`.
- **Частота:** только если update действительно вызывают в CI; но именно этот вызов и должен быть запрещён.
- **Обходной путь:** не запускать update в CI; обновлять локально и коммитить lock; добавить запрет шага в пайплайне.

## Состояние

| Источник     | Позиция                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Update в CI обычно отдельный job; install frozen не равен запрету `apm update`.                                                                                              |
| OpenAPM      | Frozen — свойство install verify, не глобальный lock на мутацию.                                                                                                             |
| Спека bapm   | `lifecycle-update`:20 — update в frozen-контексте без override MUST отказать; `install-pipeline`:44-45 — frozen + `--update` MUST fail.                                      |
| Код bapm     | `packages/core/src/modules/Update/runUpdate.ts:22,26-32` — отказ только при `options.frozen === true` и без override. CLI Update не читает `CI` и не передаёт `frozen` (`packages/cli/src/modules/Update/services/runUpdate.ts:156-173`). Install читает `CI` (`packages/cli/src/modules/Install/services/runInstall.ts:409-411,417-423`). |
| Документация | `apps/docs/guide/situations/ci-frozen.md:60`: «`update -y` при этом не блокируется — не запускайте его в CI».                                                                |
| Тесты        | `packages/core/tests/lifecycle/update.test.ts:165-202` — только явный `frozen: true`; кейса `CI=true` нет.                                                                  |

## Проверка

| Артефакт | Где смотреть                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Update/runUpdate.ts:22` — `frozen` из options; `:26-32` — `UPDATE_FROZEN_REFUSED` только без override.                              |
| Код      | `packages/cli/src/modules/Update/services/runUpdate.ts:156-173` — вызов core update без `frozen` и без `env`/`CI`.                                             |
| Код      | `packages/cli/src/modules/Install/services/runInstall.ts:409-411` — `resolveEffectiveFrozen`; `:417-423` — отказ frozen + `--update`.                           |
| Тесты    | `packages/core/tests/lifecycle/update.test.ts:165-202` — frozen refusal; `update-plan-verbose.test.ts` — план, не CI.                                           |
| Спека    | `openspec/specs/lifecycle-update/spec.md:20` — MUST refuse в frozen-контексте; `openspec/specs/install-pipeline/spec.md:47-49,66-68` — CI-default frozen только для install. |
| Docs     | `apps/docs/guide/situations/ci-frozen.md:60` — явное предупреждение.                                                                                           |

Воспроизведение:

```bash
# lock уже пинит master@old, в удалённом master появился новый коммит
CI=true bapm update -y; echo "update=$?"       # update=0, lock переписан
CI=true bapm install --update; echo "install=$?" # install=1, frozen+update rejected
```

Ожидание: в CI обе мутации запрещены без явного `--force`/`--no-frozen`.  
Факт: `update -y` применяется и двигает пин; `install --update` падает.

## Вариации

1. Как install: `CI` ⇒ `update` без явного override падает. — рекомендуется
2. Разрешить (текущее) и предупредить в docs.
3. Требовать `--force` в CI для update.

## Рекомендация

Вариант 1: CLI Update должен вычислять effective frozen из `CI` (тот же `resolveEffectiveFrozen`, что install) и отказывать без override. В core override уже есть (`force`/`override`), но CLI не парсит `--force` — добавить его или `--no-frozen` и задокументировать. Оценка S/M: S — проброс env и отказ; M — флаг, тесты, docs/спека.

Критерии закрытия:

- [ ] `CI=true bapm update -y` падает с ненулевым кодом и не меняет lock.
- [ ] явный override (`--force` или `--no-frozen`) разрешает update и описан в help/docs.
- [ ] тест на CI-default frozen для update и обновлённая спека.

## Поведение сейчас

`CI=true bapm update -y` применяет план и пишет lock. `CI=true bapm install --update` падает с `Frozen mode rejects --update` (exit `1`). Защита — дисциплина пайплайна, не флаг.

## Связанные

- [frozen-ignores-ref-change.md](./frozen-ignores-ref-change.md) — frozen-гейт не ловит смену ref.
- [update-dry-run-branches.md](./update-dry-run-branches.md) — план update скрывает drift веток.
