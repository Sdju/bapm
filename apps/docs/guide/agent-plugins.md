# Agent Plugins

[Agent Plugins](https://github.com/Sdju/agent-plugins) — переносимый формат плагина агента: один каталог с `plugin.json`, skills, MCP, командами и хуками, который разные агенты могут подключить без переделки. bapm умеет ставить такие плагины как обычные зависимости и собирать их.

## Структура плагина

```text
my-plugin/
  plugin.json
  mcp.json
  skills/
    hello/
      SKILL.md
  commands/
    ship.md          # если объявлен в plugin.json
  hooks/
    session.json     # если объявлен в plugin.json
```

Создать заготовку: `bapm plugin init --agent-plugins --skills my-plugin`. В ней будут только `plugin.json` и пример skill `skills/example/`; `mcp.json`, команды и хуки добавьте сами.

## Какие skills ставятся

Управляется полем `skills` в `plugin.json`:

| Значение                | Что ставится                                      |
| ----------------------- | ------------------------------------------------- |
| поле отсутствует        | все `skills/<name>/SKILL.md` на первом уровне     |
| `[]`                    | ни одного skill, даже если каталог `skills/` есть |
| `["hello", "skills/x"]` | только перечисленные                              |

Если перечисленный skill не найден или путь выходит за пределы плагина, установка завершается ошибкой до изменения файлов. То же для объявленных `commands` и `hooks`.

Это поле плагина, а не фильтр `skills:` в вашем `bapm.yml`: там пустой список — ошибка, а здесь — осознанный отказ от skills.

## Как плагин ставится в разные агенты

**Cursor.** MCP из `mcp.json` переводится в формат `.cursor/mcp.json` (`stdio`, `streamable-http` → `http`, `sse`). Команды — в `.cursor/commands/`, хуки — в `.cursor/hooks.json` и `.cursor/hooks/`.

**OpenCode.** MCP — в `opencode.json` (`stdio` → `local`, `streamable-http` → `remote`; `sse` не поддерживается: такой сервер молча пропускается). Skills — в `.opencode/skills/`, команды — в `.opencode/commands/`. Хуки молча пропускаются.

**GitHub Copilot.** Плагин не копируется, а регистрируется как есть из `apm_modules/`:

- bapm создаёт каталог плагинов `apm_modules/.github/plugin/marketplace.json`;
- включает его в `.github/copilot/settings.local.json` (`extraKnownMarketplaces.apm` и `enabledPlugins`).

Для этого нужен GitHub Copilot CLI версии 1.0.81 или новее. Регистрация на уровне пользователя (`$COPILOT_HOME`) не поддерживается.

**Остальные агенты** получают содержимое плагина как обычного пакета, по своим путям из [таблицы](/guide/supported-hosts#layout), с теми же [пропусками](/guide/supported-hosts#skipped).

## Сборка

```bash
bapm pack --agent-plugins
```

Собирает архив плагина. Это не публикация в маркетплейс: для маркетплейсов Claude Code и Codex см. [Сборка маркетплейса](/guide/situations/marketplace-pack).

Архив сохраняет portable-раскладку целиком: `plugin.json`, `mcp.json`, объявленные `commands` и `hooks`, `skills/` с вспомогательными файлами, `agents/`, нативные manifest-файлы и скрипты рядом с хуками. Пути в `plugin.json` не переписываются. Перед записью zip bapm проверяет declared `commands` / `hooks` / `skills`: отсутствующий путь, traversal, symlink или путь, исключённый `.bapmignore`, дают ошибку и не создают архив. `.bapmignore` подходит для authoring-файлов, но не для объявленных компонентов плагина.

## Claude Code plugin bundle

```bash
bapm pack --format claude-plugin
```

Собирает zip в нативной раскладке Claude Code: `plugin.json` в корне и `.claude-plugin/plugin.json` с тем же manifest'ом, плюс `commands/`, `agents/`, `skills/`, `hooks/` и sibling assets по исходным относительным путям. `plugin.json` берётся из корня, затем из `.claude-plugin/plugin.json`; если его нет, manifest синтезируется из `bapm.yml` / `apm.yml`.

Перед записью zip проверяются declared `commands` / `hooks` / `agents` / `skills`: отсутствующий путь, traversal, symlink или путь, исключённый `.bapmignore`, дают ошибку и не создают архив. Голое имя skill (`"hello"`) резолвится в `skills/hello`. Корневые `bapm.yml` / `apm.yml` и lock-файлы в Claude bundle не попадают.

APM умеет писать для `claude-plugin` каталог и zip (`--archive`); bapm pack всегда пишет один zip, как и в default-режиме. Это осознанное упрощение: распакуйте zip, если нужен каталог.

## Ограничения

- Нет изоляции: хуки и MCP плагина исполняются с вашими правами.
- Нет OAuth и подстановки секретов из формата плагина.
- Похожие на секреты значения в `env` MCP и небезопасные пути skills отклоняются.
- Не поддерживаются субагенты, не объявленные в `plugin.json`, и расширения формата под конкретных клиентов.

Покрытие тестами по агентам: [`AGENT_PLUGINS_COMPATIBILITY.md`](https://github.com/Sdju/bapm/blob/master/AGENT_PLUGINS_COMPATIBILITY.md).
