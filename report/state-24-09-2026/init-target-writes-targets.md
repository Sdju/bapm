# `init --target` пишет сужающий `targets:`

**Статус:** открыто  
**Класс:** продукт  
**Важность:** высокая — одна команда инициализации создаёт блок, который позже молча отрезает всех остальных агентов; Help предупреждает, но манифест уже содержит ловушку.  
**Проверено:** 08-11-2026, working tree

## Суть

Человек вызывает `bapm init --target cursor`, чтобы закрепить агента. `scaffoldTargetFields` возвращает сразу два поля: `targets: { cursor: "@b-apm/integration-cursor" }` и `active: { target: "cursor" }` (`packages/cli/src/modules/Init/services/runInit.ts:76-85`), и оба пишутся в `bapm.yml` (`:121-126`). В сгенерированном файле `active` эмитится как список map-форм, но смысл тот же.

`targets` — не «выбранный агент», а декларация разрешённых агентов. Позже `install --target claude` или добавление `claude` в `active` даст `installed for claude` и пустой `.claude/`, потому что intersection отбросит id ([targets-narrow-deploy.md](./targets-narrow-deploy.md)). Help честно говорит, что `--target` «also writes a targets: entry that limits deployment to that agent» и советует удалить блок (`runInit.ts:12-18`), но пользователь читает это уже после создания файла.

Есть второй, менее очевидный триггер: без `--target` init проверяет `deps.detectCursor(cwd)` и при наличии маркера Cursor всё равно пишет тот же сужающий блок (`runInit.ts:116-119`). То есть `bapm init -y` в проекте с `.cursor/` создаёт `targets`, хотя пользователь не просил ограничивать раскладку.

Спека это разрешает, но не требует: `producer-init:52-53` говорит, что при `--target cursor` манифест MAY содержать `target` или `targets`. Требования предупредить или отделить выбор от разрешения нет. Для известных хостов `targets` не нужен: canonical fallback и так загрузит `@b-apm/integration-<id>`. Для custom id (`x-acme-editor`) карта нужна как регистрация, поэтому просто «не писать targets» нельзя для всех случаев.

## Влияние

- **Сценарий:** новичок делает `bapm init -y --target cursor`, затем коллега с Claude запускает `bapm install --target claude` или правит `active`.
- **Кого задевает:** новички; команды с несколькими агентами; CI, который генерирует проект и проверяет файлы.
- **Последствие:** манифест с первого дня ограничивает раскладку одним агентом; добавление второго не даёт файлов и не даёт ошибки. `targets` также фиксирует пакет интеграции, который потом нужно поддерживать.
- **Частота:** каждый `init --target`; также каждый `init -y` в каталоге с `.cursor/`.
- **Обходной путь:** удалить блок `targets` из `bapm.yml` или перечислить в нём всех агентов; для custom-интеграции оставить только её ключ.

## Состояние

| Источник     | Позиция                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| APM          | Init ближе к одному host hint / active, без object-map интеграций.                                                                               |
| OpenAPM      | `targets` map — регистрация пакетов интеграций, не выбор active.                                                                                 |
| Спека bapm   | `producer-init:52-53`: `--target cursor` MAY писать `target`/`targets`; `cli-plugin-init:81-86` — то же для plugin init. Обязанности предупреждать нет. |
| Код bapm     | `packages/cli/src/modules/Init/services/runInit.ts:76-85` формирует `targets` + `active`; `:116-126` пишет их, включая auto-detect cursor.        |
| Документация | `guide/host-selection.md:45-46`: «`bapm init --target` создаёт такой блок; если в команде больше одного агента, удалите его».                     |

## Проверка

| Артефакт | Где смотреть                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/cli/src/modules/Init/services/runInit.ts:82` — `targets: { [id]: "@b-apm/integration-<id>" }`.                                                   |
| Код      | `packages/cli/src/modules/Init/services/runInit.ts:116-119` — auto-detect Cursor добавляет target без явного флага.                                         |
| Тесты    | `packages/cli/tests/producer/init.test.ts:42-65` — проверяет наличие object-map `targets` и `active`; теста на последующий narrow install нет.              |
| Спека    | `openspec/specs/producer-init/spec.md:52-53`; `openspec/specs/cli-plugin-init/spec.md:81-86`.                                                               |
| Docs     | `apps/docs/guide/host-selection.md:45-46,57`; `apps/docs/reference/init.md:18` описывает `--target` как запись в `active` и `targets`, без предупреждения о сужении. |

Воспроизведение:

```bash
mkdir bapm-init && cd bapm-init
bapm init -y --target cursor
cat bapm.yml
```

Ожидание: закреплён только выбранный агент (`active`), без глобального фильтра.  
Факт: в файле одновременно `targets: { cursor: ... }` и `active`, то есть любой другой агент позже будет отрезан.

```bash
bapm install --target claude && find .claude -type f   # пусто, exit 0
```

## Вариации

1. Писать только `active: { target: <id> }` — выбор без фильтра intersection (рекомендуется для известных хостов).
2. Писать `targets:` (текущее) — один агент «навсегда», пока блок не сотрут.
3. Писать оба, но help/init note обязан предупреждать — частично сделано в help; warning в момент генерации и в docs всё равно нужен.

## Рекомендация

Гибрид 1 и 3: для canonical id (`@b-apm/integration-<id>`) писать только `active`; для custom/vendor id (`x-…`) писать `targets` как регистрацию, потому что иначе интеграция не загрузится, и явно предупреждать. Auto-detect Cursor не должен добавлять `targets` — только `active`. Обновить `producer-init` и `cli-plugin-init`, help и docs. Оценка M: правка scaffold, spec, тестов и текста.

Критерии закрытия:

- [ ] `init --target cursor` не создаёт `targets` для canonical id.
- [ ] `init --target x-acme-editor` создаёт `targets` и предупреждает о сужении.
- [ ] `init -y` в каталоге с `.cursor/` не создаёт `targets` без явного запроса.
- [ ] тест проверяет, что последующий `install --target claude` кладёт файлы.

## Поведение сейчас

После `init --target cursor` манифест содержит и `active`, и `targets: { cursor: "@b-apm/integration-cursor" }`. Позже `install --target claude` или `active: { target: [cursor, claude] }` разложит Claude без файлов, если `claude` не добавлен в `targets`. Help и guide предупреждают, но генератор не различает canonical и custom id и не предупреждает в момент записи. Auto-detect Cursor включает тот же блок без флага.

## Связанные

- [targets-narrow-deploy.md](./targets-narrow-deploy.md) — механизм intersection, из-за которого блок режет раскладку.
- [mcp-first-agent-only.md](./mcp-first-agent-only.md) — даже без `targets` второй агент может остаться без MCP.
- [stale-specs-compile-and-cursor.md](./stale-specs-compile-and-cursor.md) — выбор active/target в спеках.
