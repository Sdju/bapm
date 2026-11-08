# Сироты после удаления пакета из манифеста

**Статус:** открыто (docs и код расходятся)  
**Класс:** баг / продукт  
**Важность:** средняя — в обычном незамороженном install сироты чистятся, но только при наличии старого inventory; без хешей или в frozen файлы остаются, а docs обещают обратное.  
**Проверено:** 08-11-2026, working tree

## Суть

Ожидание пользователя: убрал пакет из `bapm.yml`, сделал `install` — файлы агента исчезли. Механизм есть, но он узкий. `cleanupOrphanDeployedFiles` берёт предыдущий lock, находит зависимости, которых нет в текущем resolve set, и удаляет только пути из их `deployed_file_hashes` (`packages/core/src/modules/Install/deployedInventory.ts:42-69`). Если inventory нет, хешей нет или путь не записан — файл остаётся.

Вызов происходит только при `!frozen && !skipApmMaterialize` (`packages/core/src/modules/Install/runInstall.ts:331-337`). Frozen install (включая CI-default) шаг пропускает. Пустые родительские каталоги намеренно не удаляются — в коде стоит комментарий «Best-effort empty parent cleanup is intentionally skipped (fail-safe)» (`deployedInventory.ts:62`). Ошибки `unlink` глотаются (`:64`), то есть частичный сбой не виден.

Спека требует удалять сирот по inventory (`openspec/specs/install-pipeline/spec.md:120`). Docs утверждают противоположное: «если пакет убран из манифеста вручную, уже развёрнутые им файлы не удаляются» (`apps/docs/reference/install.md:54`). Верно это только для случая без inventory/frozen, поэтому пользователь не понимает, какому поведению верить. `uninstall` вызывает ту же функцию до перезаписи lock (`packages/core/src/modules/Uninstall/runUninstall.ts:107-124`), а `prune` удаляет только модули и deployed-файлы не трогает.

## Влияние

- **Сценарий:** пакет с `.agents/skills/...` удалён из `bapm.yml`; в старом lock есть `deployed_file_hashes`; запускается `bapm install`.
- **Кого задевает:** команды, которые правят манифест вручную; CI с `frozen`; пользователи старых lock без inventory.
- **Последствие:** при наличии хешей файлы удаляются (вопреки docs); без хешей или в frozen — остаются и продолжают подхватываться агентом, создавая «мёртвые» skills/rules.
- **Частота:** каждый ручной remove из манифеста; исход зависит от lock и режима frozen.
- **Обходной путь:** `bapm uninstall <name>` до правки манифеста (снимет inventory), либо удалить файлы вручную и `bapm prune` для модулей.

## Состояние

| Источник     | Позиция                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Повторный install/uninstall опирается на inventory в lock.                                                                                                                                      |
| OpenAPM      | lk-017: сверка развёрнутых файлов с хешами; orphan cleanup — производное.                                                                                                                       |
| Спека bapm   | `install-pipeline:120`: install MUST удалить orphaned harness paths из предыдущего inventory.                                                                                                  |
| Код bapm     | `runInstall.ts:331-337` — вызов только не-frozen; `deployedInventory.ts:42-69` — удаление лишь по `deployed_file_hashes`, пустые каталоги и ошибки unlink игнорируются.                        |
| Документация | `reference/install.md:54`: «файлы не удаляются» — жёстче кода; верно только без inventory или в frozen.                                                                                          |

## Проверка

| Артефакт | Где смотреть                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Код      | `packages/core/src/modules/Install/runInstall.ts:331` — `!frozen && !skipApmMaterialize`.                                            |
| Код      | `packages/core/src/modules/Install/deployedInventory.ts:54-66` — удаляются только ключи `deployed_file_hashes`.                      |
| Код      | `packages/core/src/modules/Uninstall/runUninstall.ts:108-112` — cleanup вызывается до `partitionAndWriteLockfiles`.                    |
| Тесты    | `packages/core/tests/install/cleanup-hashes-forced-target.test.ts:188` — удаление записанного orphan-файла; кейсов «нет хешей» и frozen нет. |
| Спека    | `openspec/specs/install-pipeline/spec.md:120` — cleanup обязателен.                                                                  |
| Docs     | `apps/docs/reference/install.md:54` — противоположное утверждение.                                                                   |

Воспроизведение:

```bash
mkdir bapm-orphan && cd bapm-orphan
bapm init -y --target cursor
# добавить path-зависимость с `skills/hello/SKILL.md` и поставить её
bapm install
# убрать зависимость из dependencies.apm
bapm install
ls .agents/skills/hello/SKILL.md   # файла нет: hash был в lock
```

Затем повторить с lock без `deployed_file_hashes` (удалить блок вручную) или с `bapm install --frozen`: файл остаётся.

Ожидание по docs: файл не удаляется никогда.  
Факт: не-frozen install с hash-inventory удаляет файл; без inventory и в frozen — оставляет (проверено по коду и тесту `cleanup-hashes-forced-target.test.ts:188`).

## Вариации

1. Всегда чистить по inventory (код, не-frozen) — безопасно и соответствует спеке; нужен понятный diagnostic о пропущенных путях.
2. Никогда не чистить на install, только `uninstall`/`prune` (текст docs) — предсказуемо, но оставляет сирот после ручной правки.
3. Чистить и пустые каталоги, и файлы без хешей — сейчас нет; риск задеть пользовательские файлы, поэтому только с явным подтверждением.

## Рекомендация

Оставить вариант 1, но синхронизировать docs и добавить наблюдаемость: печатать, сколько путей удалено и сколько пропущено из-за отсутствия inventory/frozen. Для пустых каталогов — отдельный `--prune-empty` или не трогать. Обновить `reference/install.md:54`, чтобы он описывал три случая: hash-inventory, нет inventory, frozen. Оценка S–M: правка текста и diagnostics, тесты на frozen/no-inventory.

Критерии закрытия:

- [ ] docs описывают фактическую матрицу: не-frozen + hashes / не-frozen без hashes / frozen.
- [ ] тест на frozen подтверждает, что cleanup не вызывается.
- [ ] при пропуске удаления есть диагностика, а не тишина.

## Поведение сейчас

Не-frozen `install` удалит файлы, которые предыдущий lock приписал снятому пакету. Нет хешей — нет удаления. Frozen (в том числе CI-default) этот шаг пропускает. `uninstall` зовёт ту же функцию перед перезаписью lock, поэтому удаление deployed-файлов идёт по старому inventory. Пустые каталоги остаются, ошибки `unlink` не влияют на exit code.

## Связанные

- [uninstall-incomplete.md](./uninstall-incomplete.md) — uninstall тоже очищает inventory, но может оставить манифест.
- [install-force-noop.md](./install-force-noop.md) — force не помогает обойти frozen и не запускает cleanup.
- [hash-formats.md](./hash-formats.md) — формат хешей, по которым ищутся сироты.
