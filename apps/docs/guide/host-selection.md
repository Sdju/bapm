# Выбор агента

`bapm install` раскладывает файлы для одного или нескольких агентов; `bapm compile` собирает один хост или несколько через `--target a,b` / `--all`. Эта страница объясняет, как агенты выбираются и как закрепить выбор.

## Порядок выбора

Первое сработавшее правило побеждает:

| №   | Источник                         | Пример                                 |
| --- | -------------------------------- | -------------------------------------- |
| 1   | Флаг командной строки            | `bapm install --target claude`         |
| 2   | `active` в `bapm.local.yml`      | `active: { target: cursor }`           |
| 3   | `active` в `bapm.yml`            | `active: { target: [cursor, claude] }` |
| 4   | `target` в `~/.bapm/config.json` | `bapm config set target cursor`        |
| 5   | Автоопределение по маркеру       | в каталоге есть `.cursor/`             |

`--target` выбирает ровно одного агента. В `active` можно перечислить несколько: install разложит файлы и настроит MCP для каждого агента, который его поддерживает, а `compile` потребует выбрать одного через `--target`.

`active` в `bapm.local.yml` полностью заменяет `active` из `bapm.yml`, а не дополняет его.

Если проект уже содержит файлы агентов, начните с инвентаризации: `bapm init --discover` покажет маркеры хостов, skills, rules, commands, hooks и MCP, а также предложит `active`. Запись манифеста — только по явному `bapm init --discover --apply`. Подробнее: [init](/reference/init#discover).

Автоопределение (auto-detect) проверяет маркеры только у установленных интеграций. Если в проекте есть `.cursor/` и `.claude/`, а установлена только `@b-apm/integration-cursor`, выбран будет Cursor. Если маркер узнали несколько установленных интеграций или ни одна, команда завершается с ошибкой:

```text
bapm: Target detection is missing or ambiguous; pass --target <id> or set active in the manifest.
Multiple host markers found (cursor (@b-apm/integration-cursor), claude (@b-apm/integration-claude)).
```

Маркеры перечислены в [таблице агентов](/guide/supported-hosts#таблица).

## User-scope / global

`bapm install --global` (`-g`) выбирает агента для пользовательских
harness-каталогов, а не для файлов проекта. Global root —
`~/.bapm` (`BAPM_HOME` override); project `bapm.yml`/lock не читаются.
Манифест и lock остаются в `~/.bapm`, а файловые примитивы раскладываются в
`$HOME`.

| №   | Источник для `--global`                                                                      |
| --- | -------------------------------------------------------------------------------------------- |
| 1   | `--target <id>`                                                                              |
| 2   | `active` в `~/.bapm/bapm.yml`                                                                |
| 3   | `target` в `~/.bapm/config.json`                                                             |
| 4   | Auto-detect по user-каталогу: `~/.cursor/`, `~/.claude/`, `~/.codex/`, `~/.config/opencode/` |

Global auto-detect использует `detectGlobal` интеграции, а не проектные маркеры.
Если найдено несколько хостов, укажите `--target`.

| Host         | Global files | Global compile        | Global MCP |
| ------------ | ------------ | --------------------- | ---------- |
| Cursor       | да           | `~/.cursor/AGENTS.md` | да         |
| Claude Code  | да           | `~/.claude/CLAUDE.md` | —          |
| Codex CLI    | да           | `~/.codex/AGENTS.md`  | —          |
| agent-skills | да (skills)  | — (compile нет)       | —          |
| OpenCode     | —            | —                     | да         |

Файловые примитивы для global поддерживают Cursor, Claude Code, Codex CLI и
agent-skills. Полный `bapm install -g` для Claude/Codex ставит файлы и
пропускает MCP с warning; `--only mcp` для них возвращает понятную ошибку.
Другие хосты без user-scope раскладки (например `opencode` для файлов или
custom target) дают `Global file install is not supported for target(s): …`.

`bapm compile --global` (`-g`) использует тот же global root `~/.bapm`, но
пишет только user-scope root context.

Выбор для `compile -g`: `--target` / `--all` → `active` из
`~/.bapm/bapm.yml` → `target` из `~/.bapm/config.json` → `detectGlobal` по
home-каталогу. `agent-skills` не имеет compile; Gemini, Copilot, OpenCode,
Windsurf, Kiro и custom targets дают
`Global compile is not supported for target(s): …`. `-o` с `--global`
запрещён, потому что путь принадлежит хосту. Подробнее:
[compile](/reference/compile#global).

`grok-bot`, `hermes` и `intellij` — explicit-only: у них нет проектного маркера, поэтому auto-detect их никогда не выберет. Указывайте `--target <id>` или `active`. `intellij` к тому же MCP-only и не поддерживает `compile`.

## Какой способ выбрать

| Ситуация                               | Решение                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| Один агент, в проекте есть его каталог | Ничего не настраивать, сработает автоопределение                                        |
| В проекте уже есть harness агентов     | `bapm init --discover`, затем `--apply` либо вписать `active` вручную                   |
| Вся команда работает в одном агенте    | `active: { target: cursor }` в `bapm.yml`                                               |
| Проект поддерживает несколько агентов  | `active: { target: [cursor, claude] }` в `bapm.yml`                                     |
| У каждого свой агент                   | `active` в личном `bapm.local.yml` — [сценарий](/guide/situations/team-local-active)    |
| Разовая установка для другого агента   | `bapm install --target <id>`                                                            |
| Личный default без правок манифеста    | `bapm config set target cursor` — [config](/reference/config)                           |
| Hermes / IntelliJ / Grok Bot           | `--target hermes` / `--target intellij` / `--target grok-bot` (auto-detect отсутствует) |

## Откуда берётся интеграция

Для известных агентов bapm загружает пакет `@b-apm/integration-<id>`: сначала ищет его в `node_modules` проекта, затем среди глобальных пакетов. Достаточно `npm i -D @b-apm/integration-cursor`, настраивать ничего не нужно.

Поле `targets` в манифесте нужно, только чтобы заменить стандартную интеграцию своей или подключить агента, которого bapm не знает. См. [Свой агент](/guide/supported-hosts#custom).

::: warning `target` и `targets` ограничивают раскладку
`targets` не выбирает агента, но если в корне `bapm.yml` есть `target` или `targets`, bapm раскладывает файлы только для перечисленных там агентов. Если активный агент не входит в этот список, install завершается ошибкой `No active target is declared in the root target/targets` (код `INSTALL_TARGETS_EMPTY_INTERSECTION`). Если часть активных агентов входит, а часть нет, установка продолжается, но для пропущенных печатается `bapm: warning: …`. `bapm init --target` пишет только `active` и такой блок не создаёт; добавляйте `target` / `targets` вручную лишь для регистрации своей интеграции и тогда перечисляйте в нём всех агентов команды.
:::

## Частые ошибки

| Сообщение                                                 | Причина и решение                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Target detection is missing or ambiguous`                | Нет ни `active`, ни маркера, или маркер узнали несколько установленных интеграций. Укажите `--target` или `active` |
| `… is not installed or resolvable`                        | Маркер найден, а интеграции нет. `npm i -D @b-apm/integration-<id>`                                                |
| `Unknown or unregistered target`                          | Опечатка в id или свой агент без записи в `targets`                                                                |
| `Manifest "active" rejects legacy bare host-token lists`  | `active: [cursor]` не поддерживается, пишите `active: { target: cursor }`                                          |
| `No active target is declared in the root target/targets` | Активный агент не входит в `target` / `targets` корня `bapm.yml`. Удалите блок или добавьте агента                 |
| `installed for <id>`, но файлов нет                       | Активный агент не входит в `target` / `targets`; при частичном пересечении install печатает `bapm: warning:`       |

Поля `active`, `target` и `targets` подробно: [Агенты в манифесте](/guide/manifest-hosts).
