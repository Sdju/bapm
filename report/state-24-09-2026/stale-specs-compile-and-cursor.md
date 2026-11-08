# Устаревшие спеки `compile-agents-md` и `cursor-mcp-deploy`

**Статус:** открыто (follow-up 4.2 change `sync-specs-with-shipped-behavior`)  
**Класс:** долг спеки  
**Важность:** средняя — спеки формально действующие и уводят spec-first реализацию к Cursor-only срезу, хотя CLI и docs уже multi-host; runtime-бага нет.  
**Проверено:** 08-11-2026, working tree

## Суть

`compile-agents-md` описывает «тонкий compile для cursor host» и отдельным требованием запрещает multi-host выводы. Фактический код выбирает зарегистрированную интеграцию по `--target`, sole `active` или detect и делегирует рендер её `compile`; help перечисляет `AGENTS.md`, `CLAUDE.md`, `…`. Пользовательская инструкция прямо говорит, что имя файла зависит от агента.

Вторая спека, `cursor-mcp-deploy`, в текущем виде остаётся cursor-capability, но связанный `install-pipeline` всё ещё формулирует MCP deploy как «Cursor MCP deploy … when the cursor target is active», хотя core вызывает `configureMcp` у любого зарегистрированного target и пишет lock-inventory по id этого target. Это противоречит соседнему требованию того же файла о target-keyed inventory.

Исходный change сознательно вынес переписывание обеих спек в follow-up 4.2. Пункт в архиве остался невыполненным, значит спеки всё ещё вводят в заблуждение.

## Влияние

- **Сценарий:** агент по `compile-agents-md` добавляет Cursor-only проверку или удаляет `--target`, хотя `bapm compile --target claude` поддерживается и документирован.
- **Кого задевает:** автор интеграции, агент-реализатор, ревьюер spec-first изменений.
- **Последствие:** реализация откатывается к cursor-only; ломается multi-host compile/MCP; тесты и docs расходятся со спекой, `openspec validate` этого не ловит.
- **Частота:** при каждой задаче, где спека читается как источник истины; runtime-пользователь не страдает.
- **Обходной путь:** сверяться с CLI help и `apps/docs/guide/situations/compile-agents.md`; в спеке — не доверять Purpose и «M9»-формулировкам.

## Состояние

| Источник     | Позиция                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Compile/MCP эволюционировали отдельно.                                                                                          |
| OpenAPM      | Compile и MCP — host-agnostic.                                                                                                  |
| Спека bapm   | `compile-agents-md` — cursor-only Purpose, «No multi-host compile outputs in M9», «Compile stays AGENTS.md-only». `install-pipeline` — Cursor-only MCP deploy. |
| Код bapm     | Compile для любого compile-capable зарегистрированного id. MCP — `configureMcp` у каждого target, inventory по его id.          |
| Документация | `guide/situations/compile-agents.md`, `supported-hosts.md`.                                                                     |

## Проверка

| Артефакт | Где смотреть                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Compile/compileAgentsMd.ts:22` — `selectCompileTarget` и `target.compile(sorted, …)`.                       |
| Код      | `packages/core/src/modules/Install/runInstall.ts:965` — `getConfigureMcp(target)` для любого target, без Cursor-ветки.                 |
| CLI      | `packages/cli/src/modules/Compile/services/runCompile.ts:131` — help: `AGENTS.md, CLAUDE.md, …`, `--target <id>`.                       |
| Спека    | `openspec/specs/compile-agents-md/spec.md:5`, `:18`, `:125`, `:172-174` — cursor-only формулировки.                                   |
| Спека    | `openspec/specs/cli-runtime-surface/spec.md:376` — `--target` назван не поддерживаемым «in this change», хотя он в help и парсере.     |
| Спека    | `openspec/specs/install-pipeline/spec.md:296` — Cursor-only MCP deploy; `:315-320` — inventory по configuring target.                 |
| Docs     | `apps/docs/guide/situations/compile-agents.md:35` — «Имя файла зависит от агента… `compile` работает с одним агентом за запуск».        |
| Change   | `openspec/changes/archive/2026-11-08-sync-specs-with-shipped-behavior/tasks.md:24` — follow-up 4.2 не отмечен.                        |

Воспроизведение:

```bash
node packages/cli/dist/cli.mjs compile --help | head -8
rg -n 'cursor host|No multi-host compile outputs|Compile stays AGENTS.md-only' openspec/specs/compile-agents-md/spec.md
rg -n 'Cursor MCP deploy|configuring target' openspec/specs/install-pipeline/spec.md
```

Ожидание: спека и CLI описывают один multi-host compile/MCP.  
Факт: CLI печатает `AGENTS.md, CLAUDE.md, …` и `--target`, спека — «for the cursor host» и «Compile stays AGENTS.md-only»; `install-pipeline` одновременно Cursor-only и target-keyed.

## Вариации

1. Переписать `compile-agents-md` под shipped multi-host, а `cursor-mcp-deploy` оставить capability-спекой, убрав Cursor-only обобщения из `install-pipeline` — рекомендуется.
2. Пометить capabilities retired — потеряется контракт для Cursor.
3. Оставить — агент «исправит» код под старую спеку.

## Рекомендация

Вариант 1. Переписать Purpose и требования `compile-agents-md` (селекция target, per-target output path, help), вычистить `in this change`/M9 из `cli-runtime-surface:376`, заменить Cursor-only формулировку `install-pipeline:296` на target-neutral. Оценка M (1–2 дня со сверкой тестов).

Критерии закрытия:

- [ ] `compile-agents-md` не содержит cursor-only Purpose и «Compile stays AGENTS.md-only».
- [ ] `install-pipeline` описывает MCP deploy через зарегистрированный target, без Cursor-only clause.
- [ ] `cli-runtime-surface` больше не запрещает `compile --target`.
- [ ] Follow-up 4.2 отмечен, `openspec validate --strict` зелёный.

## Поведение сейчас

Истина — CLI + integration packages: `compile` выбирает один target и отдаёт ему рендер; MCP configure идёт через capability каждого target. Спеки не архивированы и формально действующие; `compile-agents-md` частично обновлена (есть Claude/Codex/Copilot/Grok-сценарии), но Purpose и запреты остались от раннего Cursor-only среза.

## Связанные

- [spec-legacy-active.md](./spec-legacy-active.md) — соседний follow-up того же change (4.1), уже закрыт.
- [cli-tests-cursor-resolves.md](./cli-tests-cursor-resolves.md) — тесты, которые ещё верят в отсутствие Cursor/Claude.
- [plugin-flags-vs-spec.md](./plugin-flags-vs-spec.md) — другой пример отставания спеки от shipped CLI.
