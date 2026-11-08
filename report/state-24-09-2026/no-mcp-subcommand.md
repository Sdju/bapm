# Команды `mcp` нет, есть `approve` / `deny`

**Статус:** намеренно (thin `mcp` не регистрируется; в спеке остались условные упоминания)  
**Класс:** долг спеки / CLI surface  
**Важность:** низкая — пользователь видит корректный help и рабочие `approve`/`deny`; риск только в том, что агент по спеке реализует мёртвую команду.  
**Проверено:** 08-11-2026, working tree

## Суть

В CLI нет top-level команды `mcp`: `packages/cli/src/common/constants/commands.ts` перечисляет `policy`, `approve`, `deny`, но не `mcp`. Разрешение пакета на MCP-серверы пишется в `~/.bapm/config.json` через `bapm approve <pkg>`; запрет — через `bapm deny <pkg>`. Командный allow задаётся в `bapm.yml` секцией `executables`.

Спека `cli-runtime-surface` в одном месте говорит «install-time MCP and/or thin `mcp` command when registered», а в другом — что `policy` в этом change имеет только `status` и `approve-deny` не добавляются, хотя top-level `approve`/`deny` уже shipped. Формулировка «when registered» делает `mcp` не обязательным, но оставляет агентам лазейку проектировать его.

Карточка фиксирует это как осознанное отличие CLI surface, а не как баг: APM-совместимый интерактивный UX (`--all`, `--recommended`, policy explain) bapm не заявляет.

## Влияние

- **Сценарий:** агент читает спеку, видит «thin `mcp` command» и добавляет `bapm mcp` или `policy explain`, которых нет в help.
- **Кого задевает:** автор CLI-изменений, агент-реализатор, автор docs.
- **Последствие:** мёртвая команда или лишний scope; help и тесты расходятся; пользователь получает `unknown command "mcp"`.
- **Частота:** только при spec-first доработке CLI; обычный пользователь идёт по `guide/commands.md`.
- **Обходной путь:** `bapm approve`/`deny`; для группового разрешения — `executables` в манифесте.

## Состояние

| Источник     | Позиция                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| APM          | Интерактивный approve ближе к `apm` подкомандам policy/mcp.                 |
| OpenAPM      | Не фиксирует имя бинаря.                                                    |
| Спека bapm   | Смесь: approve/deny shipped; условный «thin `mcp` command»; milestone M8.   |
| Код bapm     | Отдельной `bapm mcp` нет; зарегистрированы `policy`, `approve`, `deny`.     |
| Документация | `guide/commands.md`, `reference/policy.md` — approve/deny/policy без `mcp`. |

## Проверка

| Артефакт | Где смотреть                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Код      | `packages/cli/src/common/constants/commands.ts:1-25` — `COMMAND_POLICY`, `COMMAND_APPROVE`, `COMMAND_DENY`; `COMMAND_MCP` нет. |
| Код      | `packages/cli/src/app/registry.ts:101-102` — маршруты `approve`/`deny`; `mcp` не зарегистрирован.                              |
| Спека    | `openspec/specs/cli-runtime-surface/spec.md:43` — «thin `mcp` command when registered».                                        |
| Спека    | `openspec/specs/cli-runtime-surface/spec.md:348` — milestone M8; `:502` — «only status… approve-deny MUST NOT be added».       |
| Спека    | `openspec/specs/cli-runtime-surface/spec.md:757-774` — top-level approve/deny и help.                                          |
| Docs     | `apps/docs/guide/commands.md:51-52` — `approve`/`deny`; `apps/docs/reference/policy.md` — флаги и user store.                  |
| Тесты    | `packages/cli/tests/mcp/approve-deny.test.ts:25`, `approve-deny-help.test.ts:9`.                                               |

Воспроизведение:

```bash
node packages/cli/dist/cli.mjs mcp --help; echo "exit=$?"
node packages/cli/dist/cli.mjs approve --help | head -5
```

Ожидание по карточке: `mcp` — unknown command, approve/deny — рабочие.  
Факт: `bapm: unknown command "mcp"` и exit 1; `approve` печатает help и exit 0.

## Вариации

1. Добавить алиас `bapm mcp` — не нужно для UX и расширяет surface.
2. Вычистить условные упоминания `mcp`/M8 из `cli-runtime-surface` — рекомендуется.
3. Оставить — агент реализует мёртвую команду.

## Рекомендация

Вариант 2. Заменить строку 43 на «help MUST mention install-time MCP» (без «thin mcp command»), убрать milestone M8 из политики и уточнить, что `approve`/`deny` — top-level, а не подкоманды `policy`. Оценка S.

Критерии закрытия:

- [ ] В `cli-runtime-surface` нет упоминаний несуществующей `mcp`-команды.
- [ ] Нет milestone-меток M8 в user-facing требованиях.
- [ ] Help/тесты approve/deny остаются зелёными.

## Поведение сейчас

Разрешение: `bapm approve <pkg>` → `~/.bapm/config.json`. Запрет: `bapm deny`. Командный allow: YAML `executables`. `bapm mcp` отсутствует: CLI печатает `unknown command "mcp"` и полный help, exit 1. Интерактивный полный APM UX (`--all`, `--recommended`, `policy explain`) не заявлен.

## Связанные

- [policy-remote-not-wired.md](./policy-remote-not-wired.md) — policy surface и org-discovery.
- [trust-bin-interactive.md](./trust-bin-interactive.md) — второй канал user-local grants (`bin/`).
