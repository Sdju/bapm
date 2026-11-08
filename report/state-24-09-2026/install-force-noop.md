# `--force` у install ничего не делает

**Статус:** открыто  
**Класс:** баг / незавершённый флаг  
**Важность:** средняя — флаг молча принимается и не меняет ни состояние проекта, ни security-гейты; портит ожидания при миграции с APM, но данные не теряет.  
**Проверено:** 08-11-2026, working tree

## Суть

`bapm install --force` разбирается CLI (`packages/cli/src/modules/Install/services/runInstall.ts:172`), передаётся в ядро (`:553`), после чего ядро явно отбрасывает значение: `void options.force;` с комментарием «Accepted for CLI parity; must not refresh refs / bypass frozen / disable policy» (`packages/core/src/modules/Install/runInstall.ts:118-119`). Никакой ветки, где `force` влияет на resolve, коллизии, lock или запись файлов, нет.

Спека закрепляет именно no-op: force не должен сам обновлять mutable refs, обходить frozen и отключать policy (`openspec/specs/install-pipeline/spec.md:531`). Help и docs это повторяют (`packages/cli/src/modules/Install/services/runInstall.ts:32`, `apps/docs/reference/install.md:24,48`). Поэтому это не «сломанный флаг», а осознанно принятый, но бесполезный аргумент.

Проблема в контракте с пользователем: в APM `--force` меняет ход установки, а в bapm тот же синтаксис даёт нулевой эффект. Скрипт миграции или CI, который передаёт `--force` «на всякий случай», получает exit 0 и неизменённое состояние. При этом флаг легко спутать с `--target` (forced target), хотя спека требует их не смешивать (`install-pipeline/spec.md:531`).

## Влияние

- **Сценарий:** CI-джоб переносит команду `apm install --force` в `bapm install --force` и ждёт refresh refs или переустановки после ручной правки lock.
- **Кого задевает:** команды, мигрирующие с APM; CI; авторы скриптов.
- **Последствие:** команда завершается успешно, но refs, кэш, lock и развёрнутые файлы остаются прежними; проблема маскируется зелёным exit code.
- **Частота:** при каждом использовании флага; сам флаг встречается в унаследованных скриптах.
- **Обходной путь:** для refs — `bapm install --update` (несовместим с frozen), для переустановки — удалить `apm_modules`/lock вручную или `bapm install --no-frozen`.

## Состояние

| Источник     | Позиция                                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | `--force` меняет ход установки (как минимум коллизии / refresh в привычном UX APM).                                                                                                                                         |
| OpenAPM      | Отдельного обязательного `--force` нет.                                                                                                                                                                                     |
| Спека bapm   | `install-pipeline:531`: force MUST NOT обновлять refs, обходить frozen и policy; «accepted for CLI parity and any future thin security-gate bypass». `cli-runtime-surface:637` требует документировать флаг и его ограничения. |
| Код bapm     | `packages/core/src/modules/Install/runInstall.ts:119` — `void options.force;`; значение дальше не используется.                                                                                                             |
| Документация | `apps/docs/reference/install.md:24,48` и help: «сейчас без эффекта».                                                                                                                                                        |

## Проверка

| Артефакт | Где смотреть                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Install/runInstall.ts:119` — единственное упоминание `force` в ядре, значение отброшено.                  |
| Код      | `packages/cli/src/modules/Install/services/runInstall.ts:172-173,553` — флаг парсится и передаётся, но не превращается в действие.   |
| Тесты    | `packages/core/tests/install/force-gates.test.ts`, `packages/cli/tests/install/project-flags-help.test.ts:136` — проверяют, что force не обходит frozen/policy, а не полезный эффект. |
| Спека    | `openspec/specs/install-pipeline/spec.md:531`; `openspec/specs/cli-runtime-surface/spec.md:637` — no-op закреплён и должен быть в help. |
| Docs     | `apps/docs/reference/install.md:24,48` — «не обновляет refs и не обходит frozen/policy».                                            |

Воспроизведение:

```bash
mkdir bapm-force && cd bapm-force
bapm init -y
bapm install --frozen --force
```

Ожидание: если `--force` что-то форсирует, установка пойдёт без lock.  
Факт: `bapm: Frozen install requires an existing lockfile; lock is absent`, exit 1 — ровно как без `--force`.

## Вариации

1. Оставить no-op навсегда и убрать флаг — ломает скрипты, которые уже передают `--force`.
2. Оставить приём флага без эффекта (текущее) — сюрприз для тех, кто шёл из APM; help честно предупреждает, но флаг остаётся ловушкой.
3. Дать узкий смысл: например, разрешить перезапись при zip-merge или refresh refs. Спека прямо запрещает refresh и обход frozen/policy; понадобится отдельный change.

## Рекомендация

Вариант 2 на короткую дистанцию: оставить no-op, но убрать его из «тихих» сценариев — печатать warning при использовании (`--force принят, но ничего не делает; см. --update`). Средний срок — вариант 1 или 3 только через спеку: либо удалить флаг в мажорной версии, либо описать один узкий эффект и покрыть тестом. Оценка S для warning, M для удаления/нового смысла.

Критерии закрытия:

- [ ] help, `reference/install.md` и warning при запуске говорят одно и то же.
- [ ] тест фиксирует отсутствие refresh/frozen/policy-обхода.
- [ ] решение по удалению или узкому смыслу закреплено в `install-pipeline` / `cli-runtime-surface`.

## Поведение сейчас

`bapm install --force` парсится, неизвестным флагом не считается (exit 0) и не меняет ни refs, ни frozen, ни policy, ни перезапись файлов. Сообщений об игнорировании нет. Не путать с `--target` (forced target): `--target` действительно переопределяет active и участвует в выборе хоста.

## Связанные

- [targets-narrow-deploy.md](./targets-narrow-deploy.md) — `--target` и сужение раскладки, с которым путают `--force`.
- [update-not-blocked-in-ci.md](./update-not-blocked-in-ci.md) — другой флаг, который меняет поведение в CI.
- [frozen-ignores-ref-change.md](./frozen-ignores-ref-change.md) — почему refresh refs нельзя получить через force.
