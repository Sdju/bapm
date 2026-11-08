# Copilot и Windsurf пишут MCP в `$HOME`

**Статус:** намеренно  
**Класс:** продукт  
**Важность:** средняя — установка проекта меняет общий user-файл машины; два проекта перетирают сервер с одинаковым именем, а ожидание «install локален» не выполняется.  
**Проверено:** 08-11-2026, working tree

## Суть

Остальные агенты держат MCP в проекте. Copilot пишет `~/.copilot/mcp-config.json` (override `COPILOT_HOME`), Windsurf — `~/.codeium/windsurf/mcp_config.json` (override `CODEIUM_HOME`, к которому добавляется `/windsurf`). Интеграции создают домашний каталог при необходимости и мержат `mcpServers` в существующий JSON; проектный `.vscode/mcp.json` Copilot и проектный MCP Windsurf не используются.
Из-за merge два проекта с разными именами серверов накопят оба в одном файле, а сервер с одинаковым именем будет перезаписан последним install. Настройки общие на все репозитории машины; `bapm lock` при этом хранит абсолютный путь к конфигу, потому что install принимает absolute/`~/…` пути.
Это заявлено в спеках обоих хостов: home-scoped MCP — часть контракта интеграции, а не ошибка. Но для пользователя это неожиданно: `install` в одном репозитории меняет поведение другого, а `uninstall`/`deny` не гарантируют очистку общего файла.

## Влияние

- **Сценарий:** два проекта на одной машине используют Copilot; в обоих объявлен сервер `github` с разными token/env.
- **Кого задевает:** команда, безопасность, пользователь с несколькими репозиториями.
- **Последствие:** последний install перезаписывает `github`, и первый проект начинает ходить с чужими настройками; секреты/URL смешиваются в общем файле.
- **Частота:** каждый install Copilot/Windsurf; коллизия — при совпадении имён серверов между проектами.
- **Обходной путь:** разные имена серверов на проект; отдельный `COPILOT_HOME`/`CODEIUM_HOME` на проект/контейнер; ручная проверка общего файла.

## Состояние

| Источник     | Позиция                                                           |
| ------------ | ----------------------------------------------------------------- |
| APM          | Те же хосты часто используют user-global MCP.                     |
| OpenAPM      | Deploy roots MAY быть вне проекта, если так зарегистрирован хост. |
| Спека bapm   | Path может быть `~/…`; install принимает tilde.                   |
| Код bapm     | `integration-copilot`, `integration-windsurf`.                    |
| Тесты        | Оба adapter-теста проверяют home-путь и merge; коллизии проектов нет. |
| Документация | `guide/supported-hosts.md:52`: явное предупреждение.              |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Код      | `packages/integration-copilot/src/createCopilotIntegration.ts:195` — `resolveCopilotHome`; `:205` — `mkdirSync(home)`; `:207` — `mcp-config.json`; `:219` — merge; `packages/integration-windsurf/src/createWindsurfIntegration.ts:159` — home; `:171` — `mcp_config.json`; `:183` — merge. |
| Код      | `packages/core/src/modules/Install/runInstall.ts:1602` — `normalizeMcpConfigPath` принимает absolute/`~/…` и пишет путь в lock. |
| Тесты    | `packages/integration-copilot/tests/configure-mcp.test.ts:40`; `packages/integration-windsurf/tests/configure-mcp.test.ts:41` — home-путь; `:105`/`:76` — сохранение чужих серверов. |
| Спека    | `openspec/specs/integration-copilot-runtime/spec.md:112`; `openspec/specs/integration-windsurf-runtime/spec.md:112`. |
| Docs     | `apps/docs/guide/supported-hosts.md:52`. |

Воспроизведение:
```bash
repo=$PWD
base=$(mktemp -d) && home=$(mktemp -d)
for i in 1 2; do
  mkdir -p "$base/p$i/dep" "$base/p$i/node_modules/@b-apm"
  ln -s "$repo/packages/integration-copilot" "$base/p$i/node_modules/@b-apm/integration-copilot"
  printf 'name: dep%s\nversion: 0.0.1\ndependencies:\n  mcp:\n    - name: shared\n      type: stdio\n      command: echo-p%s\n' "$i" "$i" > "$base/p$i/dep/apm.yml"
  printf 'name: root%s\nversion: 0.0.1\ntarget: copilot\nexecutables:\n  allow:\n    dep%s: { mcp: true }\ndependencies:\n  apm:\n    - path: ./dep\n' "$i" "$i" > "$base/p$i/bapm.yml"
done
(cd "$base/p1" && COPILOT_HOME="$home" node "$repo/packages/cli/dist/cli.mjs" install --target copilot)
(cd "$base/p2" && COPILOT_HOME="$home" node "$repo/packages/cli/dist/cli.mjs" install --target copilot)
node -e "console.log(JSON.stringify(require('$home/mcp-config.json').mcpServers))"
```

Ожидание: install проекта не меняет MCP другого проекта.  
Факт: в общем `mcp-config.json` остаётся один `shared` с `command: echo-p2` — результат второго install; первый проект потерял свою настройку.

## Вариации

1. Писать проектный MCP, если хост умеет (Copilot project mcp — отдельный формат, не используется).
2. User-global (текущее).
3. Не деплоить MCP этим хостам без отдельного флага.

## Рекомендация

Вариант 2 оставить по контракту хоста, но добавить в install явный warning с путём общего файла и списком перезаписанных имён; в lock/inventory хранить владельца (`project`) рядом с absolute path. Для команд, которым нужна изоляция, поддержать `--mcp-scope project|home` или отдельный профиль home. Оценка M (1–3 дня): warning + ownership; L — project-scope MCP для Copilot.

Критерии закрытия:

- [ ] install предупреждает, что MCP записан вне проекта;
- [ ] видно, какие серверы перезаписаны в общем файле;
- [ ] docs и спека описывают коллизию имён;
- [ ] тест: два проекта с одинаковым именем сервера → предсказуемый победитель и warning.

## Поведение сейчас

Два проекта с разными GitHub MCP на одной машине перезапишут один и тот же user-файл (при одинаковом имени — последним install). Это не bug относительно интеграций, но ломает ожидание «install проекта локален». Поле `origin` при этом попадает в host JSON, см. отдельную карточку.

## Связанные

- [mcp-origin-in-host-config.md](./mcp-origin-in-host-config.md) — `origin` в общем host-файле.
- [mcp-dir-must-exist.md](./mcp-dir-must-exist.md) — проектные хосты с opt-in каталогом.
- [deny-does-not-undeploy.md](./deny-does-not-undeploy.md) — общий файл не чистится при deny.
