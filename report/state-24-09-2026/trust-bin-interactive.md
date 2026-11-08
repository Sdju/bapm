# В TTY `bin/` ставится без `--trust-bin` при отсутствии grant-поверхности

**Статус:** намеренно  
**Класс:** продукт  
**Важность:** высокая — локальный TTY-install деплоит исполняемое из зависимости без явного согласия; предупреждение есть, но `--trust-bin` не требуется, и это расходится с CI-политикой.  
**Проверено:** 08-11-2026, working tree

## Суть

Non-interactive (truthy `CI`, `BAPM_NON_INTERACTIVE`, non-TTY stdin, frozen) не деплоит dependency `bin/` без флага или persisted `bin: true`. В интерактивном терминале срабатывает implicit consent: при `trustBin=default` и отсутствии deny/withhold `resolveBinDeployConsent` возвращает `deploy: true` с `warn: true`, install печатает trust-posture warning и копирует файлы в `.agents/bin`.
Важное уточнение: TTY не обходит лестницу. Если grant-поверхность есть (`executables.allow`/`approve`/`deny`), пакет должен быть разрешён и для `bin`; иначе резолвер вернёт `withhold` ещё до interactive-ветки. То есть старый заголовок «TTY ставит всегда» верен только для случая «surface отсутствует» или «пакет явно разрешён». Org `deny`/`deny_all` и project/user deny побеждают и TTY, и `--trust-bin`.

`--trust-bin` подавляет предупреждение для разрешённого пакета; `--no-trust-bin` запрещает deploy даже при allow. `bapm approve` пишет только `mcp: true`, поэтому grant на `bin` через approve не появляется — нужен `bapm.yml` с `bin: true` (или ручная правка user store).

## Влияние

- **Сценарий:** разработчик в терминале ставит новый пакет с `bin/`; install молча (с одним warning) кладёт исполняемое в `.agents/bin`.
- **Кого задевает:** безопасность, разработчик, команда с разными локальными и CI-настройками.
- **Последствие:** локально появляется исполняемый файл, которого в CI не будет; warning легко пропустить, а `bapm approve` не помогает его узаконить.
- **Частота:** каждый TTY-install пакета с `bin/` без grant-поверхности; CI ведёт себя иначе.
- **Обходной путь:** `--no-trust-bin`, `BAPM_NON_INTERACTIVE=1` или явный `executables.allow` с `bin: true`. Для постоянного запрета — project/user deny.

## Состояние

| Источник     | Позиция                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| APM          | Consent на исполняемое ближе к интерактивному prompt / policy.                                                            |
| OpenAPM      | Bin — executable type; consent слой — реализация.                                                                         |
| Спека bapm   | `install-trust-bin`: `--trust-bin` / `--no-trust-bin` после deny-wins лестницы; interactive default — отдельный сценарий. |
| Код bapm     | `ExecutableTrust/binConsent.ts` + install.                                                                                |
| Тесты        | `bin-consent-install.test.ts` покрывает CI/frozen/allow/interactive; TTY + surface без пакета не покрыт.                  |
| Документация | `reference/install.md:49`: TTY без флага + warning; approve ≠ bin grant.                                                  |

## Проверка

| Артефакт | Где смотреть                                                                                                                                                                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Код      | `packages/core/src/modules/ExecutableTrust/binConsent.ts:79` — ladder deny/withhold wins; `:119` — interactive default deploy+warn; `:144` — non-interactive withhold.                                                                                                                                                                                 |
| Код      | `packages/core/src/modules/ExecutableTrust/binConsent.ts:164` — `resolveIsInteractive` (`CI`, `BAPM_NON_INTERACTIVE`, frozen, stdin TTY); `packages/core/src/modules/Install/runInstall.ts:1197` — вызов consent, `:1224` — materialize, `:1225` — warning; `packages/cli/src/modules/Approve/services/runApprove.ts:60` — approve пишет только `mcp`. |
| Тесты    | `packages/core/tests/install/bin-consent-install.test.ts:44` — CI skip; `:100` — non-interactive allow; `:257` — interactive warns+deploys.                                                                                                                                                                                                            |
| Спека    | `openspec/specs/install-trust-bin/spec.md:33` — non-interactive skip; `:57` — interactive warns then deploys when ladder allows; `:59` — absent surface не блокирует.                                                                                                                                                                                  |
| Docs     | `apps/docs/reference/install.md:45,49`.                                                                                                                                                                                                                                                                                                                |

Воспроизведение:

```bash
repo=$PWD
d=$(mktemp -d) && ln -s "$repo/node_modules" "$d/node_modules"
mkdir -p "$d/dep/bin" "$d/.cursor"
printf 'name: bin-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n' > "$d/dep/apm.yml"
printf '#!/bin/sh\necho hi\n' > "$d/dep/bin/tool"
printf 'name: root\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./dep\n' > "$d/bapm.yml"
cd "$d"
node "$repo/packages/cli/dist/cli.mjs" install --target cursor; echo "non-tty=$?"
script -qec "node $repo/packages/cli/dist/cli.mjs install --target cursor" /dev/null | tail -3
ls .agents/bin
```

Ожидание: в TTY без `--trust-bin` исполняемое не появляется без явного согласия.  
Факт: non-TTY `exit 0`, `bin deploy skipped...`, `.agents/bin` нет; TTY печатает `Trust posture warning: dependency bin/ deployed under interactive default...` и кладёт `.agents/bin/tool`.

## Вариации

1. Всегда требовать `--trust-bin` или YAML grant.
2. TTY = implicit consent (текущее; только без surface или при allow).
3. `approve` умеет `bin: true` — не сделано.

## Рекомендация

Вариант 1: в TTY не деплоить без `--trust-bin` или persisted grant, а вместо implicit deploy показывать prompt/точную команду. Если оставить вариант 2 — сузить docs и warning: перечислить пакет, файлы и тот факт, что `bin` окажется в `.agents/bin`; добавить тест «TTY + surface без пакета → withhold». Оценка M (1–3 дня); вариант 3 (approve bin) — S после этого.

Критерии закрытия:

- [ ] TTY без grant не деплоит `bin/` либо явно подтверждает consent;
- [ ] `bapm approve` умеет `bin: true` или docs перестают предлагать его для persistence;
- [ ] warning называет пакет и путь deploy;
- [ ] тест: interactive + surface без пакета → withhold, не deploy.

## Поведение сейчас

Локальный `bapm install` в терминале может положить `bin/` зависимости, напечатав warning. Тот же install в GitHub Actions без `--trust-bin` и без `executables.allow.*.bin` bin не положит. `--no-trust-bin` побеждает даже allow, org deny побеждает `--trust-bin`. При наличии grant-поверхности TTY сам по себе ничего не разрешает.

## Связанные

- [policy-hooks-ungated.md](./policy-hooks-ungated.md) — второй негейтованный/слабо гейтованный тип.
- [grant-surface-all-or-nothing.md](./grant-surface-all-or-nothing.md) — как surface меняет MCP и bin.
