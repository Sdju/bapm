# Секция `executables` в файле политики только запрещает

**Статус:** намеренно  
**Класс:** продукт  
**Важность:** средняя — `executables.allow` и `mcp:` в policy-файле молча не работают, а docs обещают ошибку; это ломает ожидание администратора политики, но не портит файлы и имеет обход через `bapm.yml`.  
**Проверено:** 08-11-2026, working tree

## Суть

В части исполняемых файл `apm-policy.yml` / `bapm-policy.yml` понимает только `executables.deny` и `executables.deny_all`. `executables.allow` не отвергается: парсер читает только `deny_all` и `deny`, остальные ключи под `executables` игнорирует. Секция `mcp:` входит в список известных top-level ключей, поэтому даже warning `PL_009_UNKNOWN_KEY` не печатается, но ни один evaluator её не читает.
Это не значит, что policy-файл вообще без allow: `dependencies.allow` — отдельная секция для allowlist зависимостей и работает в `evaluateInstallPolicy`. Запрет/разрешение именно исполняемых (`executables`) устроен иначе: командный allow живёт в `bapm.yml`, пользовательский — в `~/.bapm/config.json`, а policy может только запретить.
Документация утверждает лишнее: `guide/situations/policy-mcp.md` пишет, что `executables.allow` в файле политики — ошибка, и связывает с сообщением `Policy requires a non-empty string name`. В коде это не так: сообщение возникает только при отсутствии/пустом `name`, а `executables.allow` молча теряется. `reference/policy.md` описывает поведение корректно.

## Влияние

- **Сценарий:** администратор org policy пишет `executables.allow` или `mcp: deny`, ожидая управления MCP, и коммитит файл.
- **Кого задевает:** безопасность, платформенная команда, автор policy.
- **Последствие:** правило не применяется и не диагностируется; `bapm policy status` показывает `found` и `rule_counts` без этих записей, поэтому ошибку легко не заметить.
- **Частота:** каждый policy-файл с `executables.allow` или `mcp:`; типичный сценарий миграции с APM.
- **Обходной путь:** использовать `executables.deny`/`deny_all` и `dependencies.allow`; allow для MCP — в `bapm.yml` (`executables.allow`) или `bapm approve`.

## Состояние

| Источник     | Позиция                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| APM          | Policy file ближе к общему документу allow/deny/mcp.                                          |
| OpenAPM      | Governance policy: deny-wins; allow может жить в проекте отдельно.                            |
| Спека bapm   | `policy-yaml-parse`: typed floor — `deny_all`/`deny`; прочие ключи MAY игнорироваться/warn.   |
| Код bapm     | `parseExecutables` читает только `deny_all`/`deny`; `allow` и `mcp` не дают ошибки.           |
| Тесты        | Есть parse/merge для `deny`; теста на отказ/предупреждение для `executables.allow` нет.       |
| Документация | `reference/policy.md:49` — корректно; `guide/situations/policy-mcp.md:48,70` — обещает ошибку. |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Код      | `packages/core/src/modules/Policy/parse.ts:126` — `parseExecutables`; `:134`/`:137` — только `deny_all` и `deny`; `:19` — `mcp` в `KNOWN_TOP_LEVEL`; `packages/core/src/modules/Policy/evaluate.ts:38` — evaluator читает `dependencies`, `:58` — `dependencies.allow` работает. |
| Тесты    | `packages/core/tests/policy/executables-parse-merge.test.ts:15` — закреплён parse `deny_all`/`deny`; кейса `allow`/`mcp` нет. |
| Спека    | `openspec/specs/policy-yaml-parse/spec.md:89` — поля сверх floor не должны падать, MAY игнорироваться или warning. |
| Docs     | `apps/docs/reference/policy.md:49` — «понимает только запреты»; `apps/docs/guide/situations/policy-mcp.md:48` — «ошибка». |

Воспроизведение:

```bash
repo=$PWD
d=$(mktemp -d)
printf 'name: org\nenforcement: block\nexecutables:\n  allow:\n    acme/mcp-tools: { mcp: true }\nmcp:\n  deny: [acme/mcp-tools]\n' > "$d/bapm-policy.yml"
node "$repo/packages/cli/dist/cli.mjs" policy status --policy "$d/bapm-policy.yml" --json
```

Ожидание по docs: ошибка `Policy requires a non-empty string name` или явный отказ/предупреждение про `executables.allow`.  
Факт: `exit 0`, `outcome: found`, `warnings: []`, `rule_counts.allow = 0`; `mcp:` не упоминается.

## Вариации

1. Как APM: allow и mcp-правила в policy-файле.
2. Policy = только deny, allow в манифесте; неизвестные ключи дают warning (рекомендуется).
3. Молчаливый ignore `executables.allow`/`mcp:` (текущее) — нет, он скрывает ошибку конфигурации.

## Рекомендация

Вариант 2 плюс fail-visible диагностика: на `executables.allow` и top-level `mcp` выдавать `PL_009`/`POLICY_UNSUPPORTED_KEY` с текстом «policy only denies executables; move allow to bapm.yml» и ненулевой exit при `enforcement: block` (или `policy status --check`). Это S: добавить warning в `parsePolicyDocument` и вычистить ложное обещание из `policy-mcp.md:48,70`; поддержка allow/mcp — M/L. Рекомендуется S сейчас, вариант 1 — только если нужен полный APM-совместимый policy.

Критерии закрытия:

- [ ] `executables.allow` в policy даёт видимое предупреждение или ошибку, а не тишину;
- [ ] `mcp:` в policy даёт видимое предупреждение;
- [ ] docs не обещают ошибку там, где её нет, и наоборот;
- [ ] тест: policy с `executables.allow` → ожидаемый warning/exit.

## Поведение сейчас

Команда пишет:
```yaml
# bapm.yml
executables:
  allow:
    acme/mcp-tools: { mcp: true }
```
Org/repo policy может только запретить. Прямые `dependencies.mcp` корня политика не режет. `bapm policy status` покажет `found` и нулевые `rule_counts`, но не скажет, что `executables.allow`/`mcp:` пропущены.

## Связанные

- [grant-surface-all-or-nothing.md](./grant-surface-all-or-nothing.md) — как работает allow в манифесте и user store.
- [no-policy-disables-org.md](./no-policy-disables-org.md) — второй способ обойти org deny.
- [policy-hooks-ungated.md](./policy-hooks-ungated.md) — что policy не покрывает вовсе.
