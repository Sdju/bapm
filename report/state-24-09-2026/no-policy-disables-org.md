# `--no-policy` отключает и организационный deny

**Статус:** намеренно  
**Класс:** продукт / security UX  
**Важность:** высокая — один флаг или переменная окружения выключает org `deny`/`deny_all`, то есть обходит корпоративный security-контроль, а не только локальный файл репозитория.  
**Проверено:** 08-11-2026, working tree

## Суть

Флаг звучит как «не искать `apm-policy.yml` в репозитории». Фактически `isPolicyDisabled` проверяется в самом начале `runPolicyGate`: при `noPolicy: true`, `BAPM_POLICY_DISABLE=1` или `APM_POLICY_DISABLE=1` gate возвращает `skipped` до discovery и до вызова любого provider — включая `github-owner-dotgithub`, откуда приходит org policy. Org `executables.deny` и `deny_all` тоже не загружаются: `loadOrgExecutablesForTrust` при `noPolicy` сразу возвращает пустой floor.

То есть escape hatch отключает всю цепочку: локальный `apm-policy.yml`/`bapm-policy.yml`, remote/org policy и trust-флор для MCP и `bin`. Это не «чуть мягче» и не «только репозиторный файл».

CLI не молчит полностью: в выводе появляется `bapm: policy warning: Policy gate skipped (escape hatch)`. Но предупреждение не говорит, что именно org deny перестал действовать, и не требует подтверждения. Переменная `APM_POLICY_DISABLE=1` поддержана для совместимости, хотя docs упоминают только `BAPM_POLICY_DISABLE=1`.

## Влияние

- **Сценарий:** CI-скрипт или разработчик добавляет `--no-policy` для отладки локального конфликта и коммитит/оставляет это в пайплайне; org запрет на MCP больше не применяется.
- **Кого задевает:** безопасность, платформенная команда, аудит.
- **Последствие:** MCP или `bin` (при отдельном consent) может быть установлен и записан в конфиг агента, хотя org policy это запретила; в логах только soft warning.
- **Частота:** каждый запуск с флагом/переменной; в CI может быть постоянным.
- **Обходной путь:** не использовать в общих пайплайнах; для диагностики — `bapm policy status` без флага. Отдельного «отключить только локальный файл, оставить org» режима нет.

## Состояние

| Источник     | Позиция                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| APM          | `--no-policy` / disable — широкий выключатель.                                |
| OpenAPM      | Policy off — допустимый режим с оговоркой.                                    |
| Спека bapm   | `--no-policy` пропускает discovery/evaluation.                                |
| Код bapm     | Install `noPolicy` не вызывает providers, в том числе github-owner-dotgithub. |
| Тесты        | `install-gate.test.ts` закрепляет escape для block deny; org-кейса нет.       |
| Документация | `reference/install.md:50`, `policy-mcp.md:73`.                                |

## Проверка

| Артефакт | Где смотреть                                                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Policy/escape.ts:5` — `noPolicy`, `BAPM_POLICY_DISABLE=1`, `APM_POLICY_DISABLE=1`; `gate.ts:29` — early return `skipped`; `packages/core/src/modules/Install/runInstall.ts:1265` — при `noPolicy` org executables пустые. |
| Тесты    | `packages/core/tests/policy/install-gate.test.ts:80` — `noPolicy` обходит block deny; `:96` — env escape; кейса org deny + `--no-policy` нет.                                                                                                        |
| Спека    | `openspec/specs/policy-install-gate/spec.md` — gate и escape; отдельного запрета на отключение org нет.                                                                                                                                              |
| Docs     | `apps/docs/reference/install.md:50`, `apps/docs/guide/situations/policy-mcp.md:73` — предупреждение про org.                                                                                                                                         |

Воспроизведение:

```bash
repo=$PWD
d=$(mktemp -d) && ln -s "$repo/node_modules" "$d/node_modules"
mkdir -p "$d/dep" "$d/.cursor"
printf 'name: mcp-dep\nversion: 0.0.1\ndependencies:\n  mcp:\n    - name: dep-server\n      type: stdio\n      command: echo\n' > "$d/dep/apm.yml"
printf 'name: root\nversion: 0.0.1\ntarget: cursor\nexecutables:\n  allow:\n    mcp-dep: { mcp: true }\ndependencies:\n  apm:\n    - path: ./dep\n' > "$d/bapm.yml"
printf 'name: org\nenforcement: block\nexecutables:\n  deny: [mcp-dep]\n' > "$d/bapm-policy.yml"
cd "$d"
node "$repo/packages/cli/dist/cli.mjs" install --target cursor; echo "normal-exit=$?"
node "$repo/packages/cli/dist/cli.mjs" install --target cursor --no-policy; echo "escape-exit=$?"
node -e 'console.log(Object.keys(require("./.cursor/mcp.json").mcpServers))'
```

Ожидание: `--no-policy` отключает локальный файл, но org deny остаётся.  
Факт: обычный install `exit 1` с `MCP withheld...`; с `--no-policy` — `exit 0`, `policy warning: Policy gate skipped (escape hatch)`, сервер `dep-server` записан.

## Вариации

1. Флаг глушит только файл в репозитории, org deny остаётся.
2. Флаг глушит всё (текущее).
3. Org deny нельзя отключить флагом — не сделано.

## Рекомендация

Вариант 1 как цель: разделить local и org/remote discovery, чтобы `--no-policy` снимал только локальный файл, а org deny оставался; для полного выключения — отдельный явный флаг вроде `--no-org-policy` с подтверждением. Если оставить вариант 2, усилить сообщение: перечислить, что именно отключено (org provider, deny_all), и требовать `--yes`/`CI`-осознанность. Оценка M (1–3 дня) для разделения provider-цепочки; S — для честного warning.

Критерии закрытия:

- [ ] `--no-policy` не отключает org `executables.deny`/`deny_all` либо это явно оформлено отдельным флагом;
- [ ] `BAPM_POLICY_DISABLE`/`APM_POLICY_DISABLE` описаны одинаково в docs и коде;
- [ ] warning перечисляет отключённые источники, а не только «escape hatch»;
- [ ] тест: org deny + `--no-policy` → ожидаемый withhold.

## Поведение сейчас

`bapm install --no-policy` поставит MCP, который org policy запретила. Это escape для отладки, не «чуть мягче репо-файл». Переменные `BAPM_POLICY_DISABLE=1` и `APM_POLICY_DISABLE=1` дают тот же эффект; CLI печатает только общий policy warning.

## Связанные

- [policy-remote-not-wired.md](./policy-remote-not-wired.md) — ограничения remote/ADO policy.
