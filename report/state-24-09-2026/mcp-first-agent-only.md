# MCP пишется только первому агенту

**Статус:** открыто  
**Класс:** баг / незавершённый multi-agent  
**Важность:** высокая — в штатном multi-active install второй агент получает файлы, но не MCP, при успешном exit 0; спека требует configureMcp для каждого активного хоста.  
**Проверено:** 08-11-2026, working tree

## Суть

Install materialize обходит все активные target'ы: цикл `for (const targetId of activeTargets)` вызывает `filterByIntersection` и `target.materialize` для каждого (`packages/core/src/modules/Install/runInstall.ts:420-446`). MCP-контур устроен иначе: после `configureMcp` для первого успешного target стоит безусловный `break` (`runInstall.ts:1000-1031`). Поэтому `.cursor/mcp.json` обновляется, а `.mcp.json` для Claude в том же запуске уже не рассматривается.

Спека прямо требует обратного: при непустом `active` install MUST активировать все ids и вызвать eligible materialize/MCP для каждого (`openspec/specs/install-pipeline/spec.md:593`). Требование про MCP-inventory «keyed by the configuring target» (`:313-320`) описывает один target, но не отменяет обход остальных.

Пользователь видит `bapm: installed for cursor, claude` (`packages/cli/src/modules/Install/services/runInstall.ts:577`) и пустой `.claude/` без серверов. Ограничение уже описано в docs (`apps/docs/guide/host-selection.md:16`, `apps/docs/guide/conformance.md:25`, `apps/docs/guide/situations/policy-mcp.md:54`), но это документация известного дефекта, а не решение: для команды с разными агентами MCP пропадает молча, без диагностики.

## Влияние

- **Сценарий:** `active: { target: [cursor, claude] }`, оба каталога существуют, в манифесте есть HTTP/stdio MCP-сервер.
- **Кого задевает:** команда с несколькими агентами; CI, который ставит окружение сразу для всех.
- **Последствие:** второй и последующие хосты получают skills/rules, но не серверы; MCP-инструменты недоступны, ошибки нет. Lock при этом фиксирует только первый target в `mcp_configs`.
- **Частота:** каждый install при multi-`active`; при `--target` или одном active не проявляется.
- **Обходной путь:** отдельные запуски `bapm install --target claude` и `--target cursor` (повторный configure сохраняет прежние записи inventory) либо ручная правка конфига второго агента.

## Состояние

| Источник     | Позиция                                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Исторически один активный хост за запуск; multi-agent не тот же контракт.                                                                                        |
| OpenAPM      | Deploy MCP в рамках активного target; несколько активных — не зафиксировано как MUST на каждый.                                                                  |
| Спека bapm   | `install-pipeline:573` перечисляет active ids для materialize и MCP; `:593` требует вызвать MCP для каждого активного id.                                          |
| Код bapm     | `packages/core/src/modules/Install/runInstall.ts:961-1031`: цикл по target'ам, `configureMcp` на `:1000`, `break` на `:1031` после первой успешной записи.       |
| Документация | `guide/host-selection.md:16`, `guide/conformance.md:25`, `guide/situations/policy-mcp.md:54` — «MCP получает только первый».                                     |

## Проверка

| Артефакт | Где смотреть                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Код      | `packages/core/src/modules/Install/runInstall.ts:961` — цикл по всем active targets.                                |
| Код      | `packages/core/src/modules/Install/runInstall.ts:1000-1031` — `configureMcp`, затем безусловный `break`.            |
| Тесты    | `packages/cli/tests/install/active-selection.test.ts` — multi-active проверяет materialize, но не MCP; отдельного теста на второй MCP нет. |
| Спека    | `openspec/specs/install-pipeline/spec.md:593` — MCP для каждого активного id.                                       |
| Docs     | `apps/docs/guide/host-selection.md:16` — ограничение заявлено пользователю.                                         |

Воспроизведение:

```bash
mkdir bapm-multi && cd bapm-multi
bapm init -y --target cursor
# в bapm.yml добавить claude в targets и active: { target: [cursor, claude] }
# и сервер в dependencies.mcp (см. guide/manifest-dependencies.md)
npm i -D @b-apm/integration-claude
mkdir -p .claude .cursor
bapm install
```

Ожидание: `.cursor/mcp.json` и `.mcp.json` содержат один и тот же сервер.  
Факт: `bapm: installed for cursor, claude`; `.cursor/mcp.json` есть, `.mcp.json` отсутствует (проверено на рабочем дереве 08-11-2026).

## Вариации

1. Писать MCP каждому активному агенту, который его поддерживает (рекомендуется) — соответствует `install-pipeline:593`; нужно решить, что делать с ошибкой одного target'а: fail-closed или diagnostic.
2. Писать только явно выбранному (`--target`) — тогда multi-`active` для MCP бессмыслен и должен отвергаться с подсказкой.
3. Только первому (текущее) — файлы есть у всех, серверы у одного; дешёво, но противоречит спеке и ломает совместную работу.

## Рекомендация

Вариант 1: убрать `break`, накапливать отчёты `configureMcp` по target'ам и писать inventory для каждого; при ошибке adapter'а — диагностика с target id, а не тихий пропуск. Если продуктово нужен только один хост, выбрать вариант 2 и валидировать multi-active до записи. Оценка M: правка цикла, инвентаризация lock и тесты на двух хостах.

Критерии закрытия:

- [ ] `active` из двух зарегистрированных MCP-хостов даёт два конфига и две записи в `mcp_configs`.
- [ ] ошибка второго adapter'а не маскируется успехом первого.
- [ ] тест CLI на `installed for cursor, claude` проверяет оба файла; docs и спека совпадают.

## Поведение сейчас

Порядок active: `--target` (один id) → overlay `active` → base `active` → detect. Для списка MCP вызывается `configureMcp` первого target'а с `configureMcp`, после чего цикл останавливается. Второй агент в выводе может быть `installed for <id>` без серверов. `--exclude` пропускает configure для указанного id и позволяет дойти до следующего, но не отменяет `break` после первой успешной записи. Target без `configureMcp` пропускается, и цикл идёт дальше.

## Связанные

- [mcp-dir-must-exist.md](./mcp-dir-must-exist.md) — второй хост может не писать MCP и по другой причине: каталога нет.
- [mcp-headers-dropped.md](./mcp-headers-dropped.md) — даже первый хост получает сервер без заголовков.
- [copilot-windsurf-home-mcp.md](./copilot-windsurf-home-mcp.md) — MCP в домашнем каталоге меняет картину «файла рядом нет».
- [targets-narrow-deploy.md](./targets-narrow-deploy.md) — второй агент может быть отрезан ещё до MCP.
