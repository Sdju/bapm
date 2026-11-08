# Поле `origin` во внутреннем MCP-объекте

**Статус:** открыто  
**Класс:** баг (утечка служебного поля в конфиг агента)  
**Важность:** средняя — внутренний provenance-ключ попадает в пользовательский JSON; данные не портятся, но конфиг перестаёт соответствовать схеме хоста и обрастает diff-шумом.  
**Проверено:** 08-11-2026, working tree

## Суть

При сборе серверов bapm помечает каждый как `origin: "direct" | "dependency"` и добавляет `packageName` (`packages/core/src/modules/Mcp/collect.ts:65,112`; тип — `packages/core/src/modules/Mcp/types.ts:7-11`). Это служебные поля для trust-гейта: `runInstall` отделяет direct от dependency по `server.origin` (`packages/core/src/modules/Install/runInstall.ts:878-909`).

В lock `origin` вырезается: `applyMcpInventoryToLock` фильтрует ключи `name`, `packageName`, `origin` (`packages/core/src/modules/Mcp/lockInventory.ts:32-37`). Но объект, который уходит в `configureMcp`, не очищается: `approved` передаётся в `bakeMcpServerMaps`, тот делает `{ ...server }` (`packages/core/src/modules/Mcp/bake.ts:152-170`), и `origin` сохраняется до адаптера.

Шесть адаптеров копируют неизвестные rest-поля записи, исключая только `name`, `transport`, `type`, `command`, `args`, `url`, `env`, `packageName`, `registry`, `format`, `cwd`; `origin` в списке исключений нет. Это Cursor (`packages/integration-cursor/src/createCursorIntegration.ts:293-312`), Claude (`integration-claude:329-342`), Antigravity (`integration-antigravity:355-370`), Copilot (`integration-copilot:305-318`), Windsurf (`integration-windsurf:256-269`) и Kiro (`integration-kiro:332-345`). Codex, Gemini и OpenCode собирают запись по полям и `origin` не пишут.

Прямого требования «не отправлять origin в конфиг» в спеках нет; `McpServerConfig` — host-agnostic и допускает дополнительные ключи (`packages/integration-api/src/types.ts:119-130`). Проблема не в security, а в гигиене контракта: служебное поле становится частью пользовательского файла, который может читать другой инструмент, копироваться в шаблон или валидироваться строгой схемой.

## Влияние

- **Сценарий:** обычный `bapm install` с `dependencies.mcp` на Cursor, Claude, Copilot, Windsurf, Kiro или Antigravity.
- **Кого задевает:** команды, которые коммитят MCP-конфиг или синхронизируют его между инструментами; авторы интеграций.
- **Последствие:** в `.cursor/mcp.json` и аналогах появляется `"origin": "direct"`; при смене источника сервера значение меняется, создавая diff. Строгие потребители MCP-JSON могут отвергнуть незнакомый ключ.
- **Частота:** каждый install MCP на хостах с rest-copy; на Codex/Gemini/OpenCode не проявляется.
- **Обходной путь:** удалять ключ вручную после install; при следующем install он вернётся. Надёжного обхода нет.

## Состояние

| Источник     | Позиция                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | В конфиге хоста такого поля нет.                                                                                                                              |
| OpenAPM      | Конфиг MCP — command/url/env/headers, не provenance.                                                                                                          |
| Спека bapm   | Отдельного требования нет; lock inventory уже очищается от `origin`, конфиг хоста — нет.                                                                      |
| Код bapm     | `Mcp/collect.ts:65,112` ставит `origin`; `Mcp/lockInventory.ts:36` фильтрует для lock; `runInstall.ts:984-1004` передаёт сервер в `configureMcp` без очистки. |
| Документация | Не описывает `origin` как пользовательское поле.                                                                                                              |

## Проверка

| Артефакт | Где смотреть                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Mcp/collect.ts:112` — `origin` добавляется в `CollectedMcpServer`.                                      |
| Код      | `packages/core/src/modules/Mcp/lockInventory.ts:36` — в lock ключ отфильтрован.                                                   |
| Код      | `packages/integration-cursor/src/createCursorIntegration.ts:293-312` — rest-поля копируются, `origin` не исключён.                 |
| Тесты    | Отдельного теста нет: в `packages/core/tests/install/mcp-lock-no-secrets.test.ts` проверяется отсутствие секретов, но не `origin` в host JSON. |
| Спека    | `openspec/specs/cursor-mcp-deploy/spec.md:62` описывает `mcp_*` inventory, но не запрет служебных ключей в конфиге.               |

Воспроизведение:

```bash
mkdir bapm-origin && cd bapm-origin
bapm init -y --target cursor
# в dependencies.mcp добавить http-сервер
bapm install
grep -n origin .cursor/mcp.json
```

Ожидание: `origin` есть только во внутреннем объекте и в lock его нет; в `.cursor/mcp.json` его быть не должно.  
Факт: `.cursor/mcp.json` содержит `"origin": "direct"`, `bapm.lock.yaml` — нет (проверено 08-11-2026).

## Вариации

1. Срезать `origin` перед `configureMcp` (рекомендуется) — одна точка в core, lock уже чист; `packageName` можно оставить, его адаптеры исключают.
2. Оставить и надеяться, что интеграция копирует только известные ключи — уже неверно для шести хостов.
3. Явно документировать и писать в lock — ломает чужие MCP JSON и противоречит текущей очистке lock.

## Рекомендация

Вариант 1: в `deployMcpAfterPolicy` строить `configuredServers` без `origin` (например, `const { origin, ...hostServer } = server`) либо добавить `origin: undefined` и не копировать его. Внутренний `approved` оставить с `origin` для trust-логики. Добавить тест: после install с rest-copy адаптером в записанном JSON нет `origin`, а lock не содержит ни `origin`, ни `packageName` в `mcp_servers`. Оценка S.

Критерии закрытия:

- [ ] ни один host-конфиг не содержит `origin`;
- [ ] lock остаётся чистым, trust-логика продолжает различать direct/dependency;
- [ ] тест покрывает хотя бы Cursor и один adapter с явным whitelist.

## Поведение сейчас

Lock чистый: `origin` вырезается при записи inventory. В конфиг агента поле попадает на шести хостах, которые копируют rest-поля; на Cursor это подтверждено запуском install. На Codex, Gemini и OpenCode `origin` не пишется, потому что адаптеры собирают запись по конкретным полям. `packageName` в конфиг не попадает: он есть в списке исключений у rest-copy адаптеров.

## Связанные

- [mcp-headers-dropped.md](./mcp-headers-dropped.md) — обратный дефект: нужное поле теряется, служебное проходит.
- [lock-secrets.md](./lock-secrets.md) — что именно bapm считает служебным в lock.
- [mcp-first-agent-only.md](./mcp-first-agent-only.md) — какой target получает конфиг.
