# Приоритет `env`: overlay vs bake

**Статус:** исправлено (change `2026-11-08-sync-specs-with-shipped-behavior` заархивирован)  
**Класс:** долг спеки (код согласован)  
**Важность:** низкая (закрыто; исторически средняя) — расхождение было только в формулировке main-спеки; код, тесты и docs уже следовали одному правилу.  
**Проверено:** 08-11-2026, working tree

## Суть

В манифесте есть два разных «env», и раньше они описывались одной фразой о приоритете. Для обычных настроек проекта работает overlay-модель: `bapm.local.yml` перекрывает `bapm.yml`, а переменные окружения процесса считаются самым слабым слоем. Для подстановки `${VAR}` в MCP-серверы работает другая модель: bake при `install` берёт непустое значение процесса раньше карты `env` манифеста.

Это не конфликт кода, а конфликт двух корректных правил в одном документе. Пока исключение не было записано, агент, читающий `manifest-local-overlay`, мог «исправить» bake или overlay под одну общую формулу и сломать либо секреты MCP, либо локальные настройки.

Исходная карточка ссылалась на change как на будущий фикс. Сейчас change заархивирован, исключение в main-спеке есть.

## Влияние

- **Сценарий:** `API_TOKEN=proc` в окружении CI, `env.API_TOKEN: base` в `bapm.yml`, `env.API_TOKEN: local` в `bapm.local.yml`, MCP-сервер объявляет `${API_TOKEN}`.
- **Кого задевает:** команда с общим `bapm.yml` и личным overlay; CI, где токен приходит из секрета процесса.
- **Последствие:** при неверной формулировке спеки реализация может начать писать `base`/`local` вместо токена из процесса — MCP-сервер получает чужое или устаревшее значение; либо overlay перестаёт перекрывать base.
- **Частота:** каждый install проекта с MCP и `env`; ошибка проявляется только при непустой переменной процесса.
- **Обходной путь:** не нужен; правило зафиксировано в спеке и docs.

## Состояние

| Источник     | Позиция                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Bake MCP: process env, затем манифест.                                                                                          |
| OpenAPM      | Placeholder resolution: process, затем project env map.                                                                         |
| Спека bapm   | Overlay: CLI > local yml > base yml > process-env overrides. Bake: overrides map > process env > merged manifest `env`.          |
| Код bapm     | Overlay мержит `bapm.local.yml` `env` поверх base. Bake читает `process.env` раньше merged `env`.                                |
| Документация | `guide/config-manifest.md` / `guide/manifest-overlay.md`: local env бьёт base; для MCP placeholders — process.                   |

## Проверка

| Артефакт | Где смотреть                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Mcp/bake.ts:56` — `lookupVar`: overrides → process/`env` → `manifestEnv`.           |
| Код      | `packages/core/src/modules/Manifest/localOverlay.ts:164` — `env` deep-merge, `Object.assign` с local поверх base. |
| Тесты    | `packages/core/tests/mcp/bake-env.test.ts:76` — process wins over manifestEnv; `packages/core/tests/manifest/local-overlay-merge.test.ts:62` — local env wins. |
| Спека    | `openspec/specs/manifest-local-overlay/spec.md:60` — исключение для MCP placeholders; сценарий `:72`.           |
| Docs     | `apps/docs/guide/config-manifest.md:92` — порядок process → local → base; `apps/docs/guide/manifest-overlay.md:48`. |
| Change   | `openspec/changes/archive/2026-11-08-sync-specs-with-shipped-behavior/tasks.md:5` — пункт 1.1 выполнен.      |

Воспроизведение:

```bash
rg -n 'MCP placeholder resolution is the exception' openspec/specs/manifest-local-overlay/spec.md
cd packages/core && ../../node_modules/.bin/vp test run tests/mcp/bake-env.test.ts tests/manifest/local-overlay-merge.test.ts
```

Ожидание: спека содержит исключение; оба набора тестов зелёные.  
Факт: исключение на строке 60 присутствует, тесты проходят.

## Вариации

1. Оставить два правила: «настройки CLI» vs «подстановка секретов MCP» — текущее состояние, рекомендуется.
2. Один порядок на всё — сломает либо bake, либо overlay.
3. Починить только формулировку overlay без сценария — менее проверяемо; change добавил и сценарий.

## Рекомендация

Ничего не делать: вариант 1 уже в main-спеке и покрыт тестами. Оценка S — только поддерживать инвариант при будущих правках overlay/bake.

Критерии закрытия:

- [x] В `manifest-local-overlay` есть исключение и сценарий для process env.
- [x] Тесты `bake-env` и `local-overlay-merge` закрепляют оба порядка.
- [x] Карточка переведена в `исправлено`.

## Поведение сейчас

`API_TOKEN=proc` + `env.API_TOKEN: base` в yml + `local` в overlay → в MCP попадёт `proc`. Без переменной процесса — значение overlay, затем base. Main-спека overlay содержит это исключение (`spec.md:60`), а не только change-дельту.

## Связанные

- [local-overlay-extension.md](./local-overlay-extension.md) — сам overlay как bapm-only расширение.
- [mcp-headers-dropped.md](./mcp-headers-dropped.md) — второй потребитель bake-правил (`env`/`headers`).
