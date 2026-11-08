# Неподдерживаемые типы файлов пропускаются без сообщения

**Статус:** намеренно  
**Класс:** продукт  
**Важность:** средняя — адаптеры формируют skip-diagnostics, но install их не выводит; пользователь видит успешный install и не знает, что hook/command/agent не разложен. Плюс таблица docs устарела по Grok.  
**Проверено:** 08-11-2026, working tree

## Суть

Если пакет принёс hooks, а хост их не умеет, install не пишет warning. Пользователь видит «installed for opencode» и думает, что hooks на месте. То же с commands у Codex, agents у Windsurf, non-skill primitives у agent-skills, hooks/prompts у Grok Build и SSE-MCP у OpenCode.
Механизм не в том, что интеграции «фильтруют без diagnostics»: они как раз возвращают `MaterializeReport.diagnostics` с кодами `CODEX_PRIMITIVE_UNSUPPORTED`, `WINDSURF_AGENTS_UNSUPPORTED`, `GROK_BUILD_HOOKS_UNSUPPORTED`, `AGENT_SKILLS_PRIMITIVE_UNSUPPORTED`, `OPENCODE…`. Проблема в install: цикл materialize вызывает `target.materialize`, забирает только deployed-хэши и выбрасывает `report.diagnostics`, не добавляя их в общий `diagnostics` результата. До CLI они не доходят.

Второй слой — CLI-фильтр: `emitTrustDiagnostics` печатает только сообщения, совпадающие с `withhold|unapproved|mcp_trust|trust`. Даже если бы materialize-diagnostics попали в общий список, skip-коды под этот regex не подходят. `emitPolicyDiagnostics` тоже не про них.

Историческая деталь: Grok Build уже умеет commands (`.grok/commands/<name>.md`), поэтому утверждение «Grok — hooks и commands» устарело; Grok пропускает hooks и prompts. Docs-таблица `supported-hosts#skipped` это до сих пор не отражает.

## Влияние

- **Сценарий:** пакет с command ставится на Codex; пакет с agent — на Windsurf; пакет с hook — на OpenCode.
- **Кого задевает:** новичок, автор пакета, команда с матрицей агентов.
- **Последствие:** ожидаемая функциональность отсутствует, install успешен, lock/deployed inventory не объясняет пропуск; пользователь ищет ошибку в пакете.
- **Частота:** каждый install пакета с неподдерживаемым типом; при мультиагентной матрице — постоянно.
- **Обходной путь:** смотреть таблицу `supported-hosts#skipped` в docs; проверить наличие файла в каталоге агента. Автоматического отчёта нет.

## Состояние

| Источник     | Позиция                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| APM          | Часть адаптеров логирует skip.                                                                                       |
| OpenAPM      | Неподдерживаемый primitive MAY быть пропущен; MUST ли говорить — не жёстко.                                          |
| Спека bapm   | Host materialize пропускает неизвестные типы; skip-diagnostic требуется для Grok hooks/prompts.                      |
| Код bapm     | Интеграции формируют diagnostics; install их теряет. OpenCode дополнительно пропускает `sse` и hooks.                |
| Тесты        | Adapter-тесты проверяют diagnostics; install-теста на их вывод нет.                                                  |
| Документация | `guide/supported-hosts.md:60` обещает «ничего не пишет»; таблица `:72` устарела по Grok.                             |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Код      | `packages/core/src/modules/Install/runInstall.ts:438` — `target.materialize(...)`, `:444` — только `collectTargetDeployedHashes(report)`, diagnostics не пушатся; `packages/cli/src/modules/Install/services/runInstall.ts:615` — `emitTrustDiagnostics` фильтрует только trust-текст; адаптеры: `packages/integration-codex/src/createCodexIntegration.ts:113`, `packages/integration-windsurf/src/createWindsurfIntegration.ts:102`, `packages/integration-grok-build/src/createGrokBuildIntegration.ts:124`, `packages/integration-agent-skills/src/createAgentSkillsIntegration.ts:39`, `packages/integration-opencode/src/createOpencodeIntegration.ts:121`. |
| Тесты    | `packages/core/tests/install/commands-hooks-opencode.test.ts:53`; `packages/integration-agent-skills/tests/materialize.test.ts:109`; `packages/integration-grok-build/tests/materialize.test.ts:129`. |
| Спека    | `openspec/specs/integration-grok-build-runtime/spec.md:78` — commands поддерживаются; `:92` — hooks/prompts skip с diagnostic. |
| Docs     | `apps/docs/guide/supported-hosts.md:60`, таблица `:72`. |

Воспроизведение:

```bash
repo=$PWD
d=$(mktemp -d) && ln -s "$repo/packages/core/node_modules" "$d/node_modules"
mkdir -p "$d/dep/.apm/prompts" "$d/.codex"
printf 'name: cmd-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n' > "$d/dep/apm.yml"
printf -- '---\ndescription: demo\n---\n# Demo\n' > "$d/dep/.apm/prompts/demo.prompt.md"
printf 'name: root\nversion: 0.0.1\ntarget: codex\ndependencies:\n  apm:\n    - path: ./dep\n' > "$d/bapm.yml"
cd "$d"
node "$repo/packages/cli/dist/cli.mjs" install --target codex; echo "exit=$?"
find .codex -type f
```

Ожидание: warning `Codex does not materialize command primitives...` или иной видимый skip.  
Факт: `exit 0`, в выводе только `installed for codex`, `.codex/commands` отсутствует; diagnostic существует только внутри adapter-report и теряется.

## Вариации

1. Печатать `skipped hooks for opencode` в обычном выводе.
2. Тихий skip (текущее).
3. Fail-closed, если пакет декларирует только неподдерживаемые типы.

## Рекомендация

Вариант 1: прокинуть `report.diagnostics` в общий список и печатать skip-коды (с `--verbose` — полностью, без него — одной строкой на тип). Сделать это до `collectTargetDeployedHashes`, чтобы dry-run тоже видел. Заодно обновить таблицу docs по Grok. Оценка S (полдня) на проброс + тест; M — если добавлять fail-closed для «только неподдерживаемые типы».

Критерии закрытия:

- [ ] install печатает skip для каждого неподдерживаемого primitive;
- [ ] `--verbose`/dry-run содержат коды диагностик;
- [ ] таблица `supported-hosts#skipped` совпадает с кодом (Grok commands поддерживаются);
- [ ] install-e2e тест: Codex + command → warning и отсутствие файла.

## Поведение сейчас

Таблица пропусков — в docs, не в выводе CLI. Codex не кладёт commands, Windsurf — agents, Grok — hooks и prompts (commands уже кладёт), agent-skills — всё кроме skills, OpenCode — hooks и SSE-MCP. Все эти случаи завершаются успешным install без пользовательского warning.

## Связанные

- [mcp-dir-must-exist.md](./mcp-dir-must-exist.md) — тот же потерянный diagnostics на MCP-пути.
- [policy-hooks-ungated.md](./policy-hooks-ungated.md) — hooks, которые хост всё-таки поддерживает.
