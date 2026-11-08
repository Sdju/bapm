# Hooks и canvas не под ExecutableTrust

**Статус:** намеренно  
**Класс:** намеренное отличие / soft security  
**Важность:** высокая — dependency может исполнять hook на хосте без grant, хотя MCP и `bin/` гейтятся; отличие заявлено в conformance, поэтому не «неизвестная дыра», но обход trust-контроля реальный.  
**Проверено:** 08-11-2026, working tree

## Суть

ExecutableTrust покрывает два типа исполняемого: `mcp` (резолвер вызывается в `runInstall.ts` на каждом dependency-сервере) и `bin` (через `resolveBinDeployConsent`). Hooks материализуются как обычные primitives в общем цикле `target.materialize` — до MCP-гейта и без вызова резолвера. Поэтому пакет, которого нет в `executables.allow`, всё равно кладёт hook в `.cursor/hooks.json`, `.claude/settings.json`, `.codex/hooks.json` и т.п.
Условие срабатывания: пакет пришёл из зависимости и у хоста есть hook-адаптер (Cursor, Claude, Codex, Windsurf, Kiro, Gemini, Copilot, Antigravity). Если хост hooks не поддерживает (OpenCode, Grok Build, agent-skills), hook пропускается — но это ограничение хоста, а не trust-гейт.

Canvas в текущем дереве как primitive не реализован: `grep -rn canvas packages --include=*.ts` не находит материализации, слово осталось в спеке и `CONFORMANCE.md`. Практический разрыв — hooks; формулировка про canvas декларативна.

Спека фиксирует это намеренно: hooks/canvas MUST оставаться ungated, а conformance MUST перечислять их в limitations. Отличие от APM: APM обещает более широкий approve UX, но и там hooks не обязательно в одной лестнице с MCP.

## Влияние

- **Сценарий:** CI или локальный `bapm install` пакета с `hooks/` при `executables.allow`, где этот пакет не указан.
- **Кого задевает:** безопасность, команда, ревьюер зависимости.
- **Последствие:** MCP пакета withheld, но hook-скрипт записан и будет запущен хостом; grant-поверхность создаёт ложное ощущение, что исполняемое пакета закрыто.
- **Частота:** каждый install пакета с hooks на поддерживающем хосте; в CI и локально одинаково.
- **Обходной путь:** нет гранулярного запрета hooks: `bapm deny` и `executables.deny` действуют только на MCP/`bin`. Помогает лишь не добавлять пакет в зависимости или убрать hook из пакета.

## Состояние

| Источник       | Позиция                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| APM            | Approve UX шире (в т.ч. recommended/all); hooks не обязательно в той же лестнице.                                       |
| OpenAPM sc-009 | Executable governance; bapm заявляет MCP + bin, не hooks/canvas.                                                        |
| Спека bapm     | `executable-mcp-trust`: hooks/canvas MUST оставаться ungated, `bin` — gated.                                            |
| Код bapm       | Materialize hooks (`runInstall.ts:438`) не зовёт `resolveExecutableTrust`; резолвер вызывается только для MCP (`:883`). |
| Тесты          | Hook-deploy без grant закреплён (`commands-hooks-cursor.test.ts:98`); теста «surface present + unapproved hook» нет.    |
| Документация   | `CONFORMANCE.md:41,53`, `guide/conformance.md:40`.                                                                      |

## Проверка

| Артефакт | Где смотреть                                                                                                                                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Install/runInstall.ts:438` — `target.materialize(filtered, …)` для всех primitives, до MCP; `:883` — резолвер только для `mcp`; `:1197` — `resolveBinDeployConsent` для `bin`; `packages/integration-cursor/src/createCursorIntegration.ts:151` — hooks пишутся без проверки grant. |
| Тесты    | `packages/core/tests/install/commands-hooks-cursor.test.ts:98` — hook деплоится без `executables`; `packages/core/tests/spec-conformance/install-trust-bin-soft-honesty.test.ts:35` — проверяет только формулировку docs.                                                                                      |
| Спека    | `openspec/specs/executable-mcp-trust/spec.md:102` — hooks/canvas ungated, `bin` gated.                                                                                                                                                                                                                         |
| Docs     | `CONFORMANCE.md:41`, `CONFORMANCE.md:53`, `apps/docs/guide/conformance.md:40`.                                                                                                                                                                                                                                 |

Воспроизведение:

```bash
repo=$PWD
d=$(mktemp -d) && ln -s "$repo/node_modules" "$d/node_modules"
mkdir -p "$d/dep/.apm/hooks" "$d/dep/scripts" "$d/.cursor"
printf 'name: hook-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n' > "$d/dep/apm.yml"
printf '{"version":1,"hooks":{"sessionStart":[{"command":"./scripts/notify.sh"}]}}\n' > "$d/dep/.apm/hooks/session-start.json"
touch "$d/dep/scripts/notify.sh"
printf 'name: root\nversion: 0.0.1\ntarget: cursor\nexecutables:\n  allow:\n    acme/other: { mcp: true }\ndependencies:\n  apm:\n    - path: ./dep\n' > "$d/bapm.yml"
(cd "$d" && node "$repo/packages/cli/dist/cli.mjs" install --target cursor)
cat "$d/.cursor/hooks.json"
```

Ожидание: пакет `hook-dep` не разрешён, hook не должен попасть на хост.  
Факт: install завершается `0`, `.cursor/hooks.json` содержит `sessionStart` с `./.cursor/hooks/...`; предупреждения нет.

## Вариации

1. Распространить лестницу на hooks/canvas (deny-wins + grant).
2. Оставить soft (текущее) и честно писать в conformance.
3. Заявлять полный APM approve — не сделано (`--all` / `--recommended` / policy explain — soft).

## Рекомендация

Вариант 1 для hooks: прогонять hook-primitives через `resolveExecutableTrust(type: "hook")` до `target.materialize`, с org/project/user deny и grant; canvas либо реализовать с тем же гейтом, либо убрать из спеки и conformance. Если решено оставить soft — вариант 2, но добавить в `bapm install` явный warning «hooks not gated» и тест на этот контракт. Оценка M (1–3 дня) для hooks; L, если добавлять canvas как primitive.

Критерии закрытия:

- [ ] unapproved dependency hook не попадает в host-файл при наличии grant-поверхности;
- [ ] org `executables.deny`/`deny_all` блокирует hooks так же, как MCP;
- [ ] спека и `CONFORMANCE.md` синхронизированы с фактическим поведением;
- [ ] тест install-e2e: surface present + hook unapproved → hook withheld, skill/materialize продолжается.

## Поведение сейчас

Пакет с hook раскладывает его даже если в `executables.allow` его нет и даже если org policy запрещает пакет для MCP. `bin/` в non-interactive без grant и без `--trust-bin` не раскладывается. См. [trust-bin-interactive.md](./trust-bin-interactive.md). CLI не печатает предупреждения о том, что hooks вне гейта; узнать можно только из conformance.

## Связанные

- [trust-bin-interactive.md](./trust-bin-interactive.md) — второй исполняемый тип и его consent-лестница.
