# HTTP `headers` MCP не попадают в конфиг агента

**Статус:** открыто  
**Класс:** баг  
**Важность:** высокая — задокументированная и заявленная в спеке возможность молча не работает: сервер с обязательным `Authorization` остаётся недоступен, ошибки нет.  
**Проверено:** 08-11-2026, working tree

## Суть

`headers` у HTTP/SSE-сервера можно объявить в `dependencies.mcp`; манифест принимает поле без ошибки. Bake-слой умеет его обрабатывать: `bakeMcpServerMaps` явно резолвит `env` и `headers` (`packages/core/src/modules/Mcp/bake.ts:143-169`), а `bakeMcpStringMap` поддерживает `${VAR}`, `${env:VAR}`, `<VAR>` и `{bake:NAME}` (`bake.ts:6-16,109-141`).

Поле теряется раньше — в collect. Локальный тип `ParsedMcpEntry` не содержит `headers` (`packages/core/src/modules/Mcp/collect.ts:11-20`), `parseMcpList` не копирует его из манифеста (`collect.ts:125-137`), `toCollected` не переносит (`collect.ts:103-114`). Поэтому в `approved` и `configureMcp` уходит сервер без заголовков, bake их уже не видит, а в lock `mcp_servers` они тоже не попадают.

Это не ограничение хостов: Cursor переносит неизвестные rest-поля записи (`packages/integration-cursor/src/createCursorIntegration.ts:293-312`), Gemini пишет `headers` явно (`packages/integration-gemini/src/createGeminiIntegration.ts:337`), OpenCode — для remote (`packages/integration-opencode/src/createOpencodeIntegration.ts:283-286`). Если бы collect их сохранил, большинство адаптеров записало бы поле. Спека требует обратного текущему: `cursor-mcp-deploy:119-121`, `integration-cursor-runtime:147-149` и `mcp-env-bake:11` говорят о bake и записи `headers`. Docs честно фиксируют дефект: «в конфиг агента не передаются вовсе» (`apps/docs/guide/manifest-dependencies.md:121`).

## Влияние

- **Сценарий:** remote MCP с `headers: { Authorization: "Bearer ${MCP_TOKEN}" }`, установка для Cursor/Claude/Gemini.
- **Кого задевает:** команды и CI, подключающие защищённый MCP; авторы пакетов с MCP.
- **Последствие:** конфиг агента содержит `url`, но не заголовок; сервер отвечает 401/403. Плейсхолдер не бейкается и не даёт ошибку, потому что поле не доходит до bake. Ручная правка конфига перезаписывается при следующем install: bapm владеет записью сервера (`createCursorIntegration.ts:237-250`).
- **Частота:** каждый install MCP-сервера с `headers`; без заголовков не проявляется.
- **Обходной путь:** прописать заголовок в агенте вручную после install и не переустанавливать; надёжного обхода нет.

## Состояние

| Источник     | Позиция                                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | HTTP MCP с заголовками (в т.ч. Authorization) поддерживается в конфиге хоста.                                                                                                                                                                 |
| OpenAPM      | `headers` — допустимая часть декларации MCP.                                                                                                                                                                                                  |
| Спека bapm   | `mcp-env-bake:11` печёт `env` и `headers`; `cursor-mcp-deploy:119-121` и `integration-cursor-runtime:147-149` требуют записать bake-значения `headers` в конфиг.                                                                                                                       |
| Код bapm     | `Mcp/collect.ts:11-20,103-114,125-137` — `headers` отсутствует в типе и не копируется. `Mcp/bake.ts:143-169` умеет печь, но получает сервер уже без поля. Lock `mcp_servers` тоже без `headers`.                                               |
| Документация | `guide/manifest-dependencies.md:121`: «headers … в конфиг агента не передаются вовсе».                                                                                                                                                         |

## Проверка

| Артефакт | Где смотреть                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Код      | `packages/core/src/modules/Mcp/collect.ts:125-137` — whitelist полей без `headers`.                                       |
| Код      | `packages/core/src/modules/Mcp/collect.ts:103-114` — `toCollected` не переносит `headers`.                                |
| Тесты    | `packages/core/tests/mcp/bake-env.test.ts:107`, `bake-resolver.test.ts:57` — проверяют bake map напрямую, без прохода collect → configureMcp. |
| Спека    | `openspec/specs/cursor-mcp-deploy/spec.md:119-121`; `openspec/specs/integration-cursor-runtime/spec.md:147-149`; `openspec/specs/mcp-env-bake/spec.md:11`.                             |
| Docs     | `apps/docs/guide/manifest-dependencies.md:121` — ограничение описано.                                                     |

Воспроизведение:

```bash
mkdir bapm-headers && cd bapm-headers
bapm init -y --target cursor
# в dependencies.mcp добавить:
#   - name: docs
#     registry: false
#     transport: http
#     url: https://mcp.example.com/
#     headers: { Authorization: "Bearer ${MCP_TOKEN}" }
MCP_TOKEN=secret bapm install
cat .cursor/mcp.json
```

Ожидание: в записи `docs` есть `headers.Authorization = "Bearer secret"`; в lock — исходный `${MCP_TOKEN}`.  
Факт: `headers` нет ни в `.cursor/mcp.json`, ни в `bapm.lock.yaml`; диагностики нет (проверено 08-11-2026).

## Вариации

1. Прокинуть `headers` через collect → bake → configureMcp (рекомендуется) — соответствует `mcp-env-bake` и `cursor-mcp-deploy`; нужен тест на весь путь и решение, что делать с нестроковыми значениями.
2. Оставить drop и требовать ручную настройку (текущее) — ломает auth-сценарий и противоречит спеке.
3. Печь headers только в lock — lock тоже не сохранит их, пока collect их выкидывает; и это не решает конфиг агента.

## Рекомендация

Вариант 1: добавить `headers?: Record<string, string>` в `ParsedMcpEntry`, читать поле в `parseMcpList`, копировать в `toCollected`; дальше текущий `bakeMcpServerMaps` и адаптеры уже работают. Добавить интеграционный тест collect → lock/configureMcp и проверку fail-closed для отсутствующего `${VAR}`. Оценка S–M: правка небольшая, но нужны тесты на Cursor и один translate-хост.

Критерии закрытия:

- [ ] `headers` доходят до `configureMcp` и пишутся в конфиг поддерживающего хоста.
- [ ] lock хранит authored-значения с плейсхолдерами, а не секреты.
- [ ] отсутствующая переменная даёт `MCP env bake failed` с именем переменной.

## Поведение сейчас

`headers` в `dependencies.mcp` игнорируются на этапе collect. Если серверу нужен заголовок авторизации, его надо прописать в агенте вручную, и эта правка нестабильна при повторном install. Значения из `${VAR}` в headers не подставляются, потому что поле не доходит до bake; в lock его тоже нет. В отличие от `env`, отсутствие `headers` не приводит к ошибке.

## Связанные

- [mcp-origin-in-host-config.md](./mcp-origin-in-host-config.md) — обратная проблема: служебное поле, наоборот, доходит до конфига.
- [mcp-first-agent-only.md](./mcp-first-agent-only.md) — второй агент не получает MCP вообще, даже без headers.
- [mcp-dir-must-exist.md](./mcp-dir-must-exist.md) — ещё один молчаливый пропуск MCP.
