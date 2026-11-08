# Запечённые секреты в lock

**Статус:** исправлено (working tree, change `fix-install-safety`)  
**Класс:** баг  
**Важность:** низкая (закрыто; исторически критично) — токен из окружения попадал в `bapm.lock.yaml`, который предназначен для коммита.  
**Проверено:** 08-11-2026, working tree

## Суть

Bake подставляет `${GITHUB_TOKEN}` в объект сервера перед записью в агента. Тот же объект раньше уходил в `bapm.lock.yaml`. Lock предназначен для коммита, поэтому секрет попадал в git-историю.

Теперь в lock передаётся исходный список `approved` (декларации до bake), а `configuredServers` с подставленными значениями используется только для `configureMcp`. Запись в lock идёт через `applyMcpInventoryToLock`, который копирует поля сервера как есть, сохраняя `${VAR}` и `{bake:VAR}`.

Ограничение осталось: генератор не вычищает уже закоммиченные секреты и не переписывает lock в frozen-режиме. Исправление предотвращает новые утечки, а не лечит старые.

## Влияние

- **Сценарий:** `dependencies.mcp[].env.API_TOKEN: "${API_TOKEN}"` или `"{bake:TOKEN}"`, `bapm install`, затем `git add bapm.lock.yaml && git commit`.
- **Кого задевает:** команда и безопасность; секрет уходит в общий репозиторий и историю git.
- **Последствие:** раньше lock содержал литеральный токен, и ротация требовалась после любого коммита; теперь в lock остаётся placeholder, литерал — только в конфиге агента.
- **Частота:** каждый install с MCP env/headers, где срабатывает bake.
- **Обходной путь:** для уже закоммиченных lock — повторный `bapm install` и смена токенов (документировано).

## Состояние

| Источник     | Позиция                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| APM          | Lock хранит декларации MCP, не runtime secrets.                                                                |
| OpenAPM      | Lock — пины и inventory, не секреты.                                                                           |
| Спека bapm   | ADDED `mcp-env-bake`: baked values MUST NOT persist in the lockfile.                                           |
| Код bapm     | `applyMcpInventoryToLock({ servers: approved })` — authored (до bake), не `configuredServers`.                 |
| Тесты        | `tests/install/mcp-lock-no-secrets.test.ts` — lock без секрета, scrub stale inventory, frozen не трогает.      |
| Документация | `manifest-dependencies.md`: lock с `${VAR}`; агент — с значениями. Старые lock — re-install + ротация токенов. |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Код      | `packages/core/src/modules/Install/runInstall.ts:984` — `configuredServers` получает bake; `:1000` — только `configureMcp`. |
| Код      | `packages/core/src/modules/Install/runInstall.ts:1042` — в lock уходит `servers: approved`; `:948` — тот же `approved` на раннем return без target. |
| Код      | `packages/core/src/modules/Install/runInstall.ts:1095` — `applyMcpInventoryToLock`; `Mcp/lockInventory.ts:32` — поля копируются без bake. |
| Тесты    | `packages/core/tests/install/mcp-lock-no-secrets.test.ts:100` — lock содержит `${API_TOKEN}` и `{bake:BAKE_ME}`, не содержит секретов; `:108` — stale inventory вычищается; `:140` — frozen оставляет старый lock. |
| Спека    | `openspec/specs/mcp-env-bake/spec.md:113` — authored declarations в lock; `:120` — токен не попадает. |
| Docs     | `apps/docs/guide/manifest-dependencies.md:108`, `:115` — placeholder в lock, значения в конфиге агента, предупреждение и ротация. |

Воспроизведение:

```bash
pnpm -C packages/core test tests/install/mcp-lock-no-secrets.test.ts
```

Ожидание: в `bapm.lock.yaml` — `${API_TOKEN}` / `{bake:BAKE_ME}`, в конфиге агента — литерал.  
Факт: на текущем дереве 6 тестов зелёные; литеральный `SECRET` в lock не появляется.

## Вариации

1. Писать bake в lock (старое, утечка).
2. Писать placeholders (текущее, **рекомендуется**).
3. Не писать MCP inventory в lock вовсе — теряется `mcp_configs`/provenance для аудита.

## Рекомендация

Держать `approved` единственным входом для lock и не передавать в `applyMcpInventoryToLock` результат bake. Regression guard: тест, где конфиг агента получает литерал, а lock — placeholder, плюс сценарий scrub после удаления декларации. S.

Критерии закрытия:

- [x] lock не содержит значений из process env / manifest `env`;
- [x] `${VAR}`, `${env:VAR}`, `<VAR>`, `{bake:VAR}` сохраняются в lock;
- [x] stale baked inventory вычищается на non-frozen install;
- [x] спека и docs предупреждают о ротации уже утёкших токенов.

## Поведение сейчас

В lock: `GITHUB_TOKEN: ${GITHUB_TOKEN}`. В `.cursor/mcp.json`: настоящее значение (кроме Kiro/Copilot, у которых `mcpEnvMode: "translate"` — `${VAR}` остаётся для env, но `{bake:VAR}` подставляется). Уже закоммиченные секреты генератор не вычищает: нужен повторный install и смена токенов. Frozen install намеренно не переписывает lock, поэтому старый секрет в нём сохраняется. Конфиг агента по-прежнему секрет.

## Связанные

- [env-precedence.md](./env-precedence.md) — откуда bake берёт значение для `${VAR}`.
- [mcp-headers-dropped.md](./mcp-headers-dropped.md) — headers в конфиге агента, отдельная ветка MCP.
- [zip-extract-merge.md](./zip-extract-merge.md) — первое исправление того же change.
