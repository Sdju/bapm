# Тесты читают `~/.bapm` пользователя

**Статус:** открыто  
**Класс:** тест  
**Важность:** высокая — suite читает реальный user store: после `bapm approve` локально зелёный тест падает, а в CI с другим `$HOME` результат другой; воспроизведено падение `bin-consent-install`.  
**Проверено:** 08-11-2026, working tree

## Суть

`loadUserExecutableGrants` по умолчанию резолвит `homedir()/.bapm/config.json`. Core install вызывает её с `configDir: args.configDir`, но CLI и почти все тесты не передают `configDir`, поэтому читается домашний каталог разработчика/агента. Дополнительно `approve`/`deny` пишут именно туда.

Из-за этого grant-surface зависит от машины: если в `~/.bapm/config.json` есть `executables.allow` для пакета из фикстуры, install перестаёт withhold-ить `bin/`, и тест, ожидающий fail-closed, получает развёрнутый бинарь. Это не регрессия продукта, а загрязнение user store; исходная сессия столкнулась с этим после ручного `approve` (файл пришлось убрать в `config.json.audit-leftover`).

В репозитории нет глобального test setup, который подменял бы `HOME`; шесть файлов тестов делают это вручную, остальные — нет. В текущем окружении `~/.bapm/config.json` отсутствует, поэтому падение скрыто до первого approve.

## Влияние

- **Сценарий:** разработчик выполнил `bapm approve acme/bin-plugin` (или любой пакет из фикстур), затем запускает `pnpm test`.
- **Кого задевает:** вся команда и CI; особенно агентские сессии, где `HOME` общий.
- **Последствие:** недетерминированные падения core-тестов; ложная диагностика «регрессия install»; в обратную сторону — тест может пропустить security-дефект, если grant случайно разрешает пакет.
- **Частота:** каждый запуск suite на машине с непустым `~/.bapm/config.json`; на чистой машине не проявляется.
- **Обходной путь:** временно убрать `~/.bapm/config.json`; в тестах — передавать `configDir`/`HOME` в tmp (сделано только в части suite).

## Состояние

| Источник     | Позиция                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------- |
| APM          | Свои фикстуры; не относится.                                                                       |
| OpenAPM      | Не регламентирует test harness.                                                                    |
| Спека bapm   | Нет требования изоляции HOME.                                                                      |
| Код bapm     | User store читает `~/.bapm` при отсутствии `configDir`; install пробрасывает только явный `configDir`. |
| Тесты        | Часть suite задаёт tmp cwd, но не HOME/configDir; глобального setup нет.                           |
| Документация | Нет.                                                                                               |

## Проверка

| Артефакт | Где смотреть                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/ExecutableTrust/userStore.ts:39-43` — `resolveUserConfigRoot` → `homedir()/.bapm`.             |
| Код      | `packages/core/src/modules/Install/runInstall.ts:824`, `:1175` — `loadUserExecutableGrants({ configDir: args.configDir })`. |
| Тесты    | `packages/core/tests/install/bin-consent-install.test.ts:44` — тест не передаёт configDir.                                 |
| Тесты    | Изоляция есть точечно: `packages/cli/tests/mcp/approve-deny-helpers.ts:53`, `packages/core/tests/marketplace/resolve-graph.test.ts:22`. |
| Конфиг   | `packages/core/vite.config.ts` — нет `test.setupFiles`/`globalSetup` с подменой HOME.                                      |

Воспроизведение:

```bash
mkdir -p /tmp/bapm-poison-home/.bapm
printf '%s\n' '{"executables":{"allow":{"acme/bin-plugin":{"bin":true}},"deny":{}}}' \
  > /tmp/bapm-poison-home/.bapm/config.json
cd packages/core
HOME=/tmp/bapm-poison-home ../../node_modules/.bin/vp test run tests/install/bin-consent-install.test.ts -t 'CI install skips bin'
```

Ожидание: тест изолирован от user store и зелёный.  
Факт: `expected true to be false` на `deployedBinExists(project.cwd)` — бинарь развернулся из-за grant в подставном `~/.bapm`.

## Вариации

1. Глобальный test setup: `HOME=<tmp>` (и/или `XDG_*`) + пустой `~/.bapm` для всех пакетов — рекомендуется.
2. Каждый install-тест передаёт `configDir: tmp` — точечно, но легко забыть.
3. Запретить чтение user store в unit-тестах без явного порта — потребует API-изменений.

## Рекомендация

Вариант 1 + 2: в `vite.config.ts` каждого пакета добавить `test.setupFiles` с временным HOME; тестам, которые проверяют grants, передавать `configDir` явно. Проверить suite с «отравленным» `~/.bapm/config.json` в CI-матрице. Оценка M (1–2 дня на аудит 27 test-файлов с `runInstall`).

Критерии закрытия:

- [ ] `HOME` в тестах указывает на tmp; `~/.bapm` пользователя не читается.
- [ ] `bin-consent-install` зелёный при grant в реальном `~/.bapm`.
- [ ] Есть регрессионный тест/CI-проверка с непустым user store.

## Поведение сейчас

`HOME` в среде агента был `/tmp/v3/home`, но реальный `~/.bapm` всё равно читался частью suite. Падения core после ручного `approve` — не регрессия продукта, а загрязнение store. Сейчас на машине `~/.bapm/config.json` нет, поэтому suite зелёный; изоляция не гарантирована.

## Связанные

- [cli-tests-cursor-resolves.md](./cli-tests-cursor-resolves.md) — второй источник недетерминизма тестов (module resolution).
- [trust-bin-interactive.md](./trust-bin-interactive.md) — логика grants/consent, которую тесты проверяют.
