# Поддерживаемые агенты

Каждый агент подключается отдельным npm-пакетом. Поставьте интеграцию своего агента рядом с CLI:

```bash
npm i -D @b-apm/cli @b-apm/integration-<id>
```

Больше ничего настраивать не нужно: bapm найдёт пакет по id агента. Как bapm решает, для какого агента ставить: [Выбор агента](/guide/host-selection).

## Таблица

| Агент          | id             | Пакет                             | Маркер для auto-detect                                                               |
| -------------- | -------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| Cursor         | `cursor`       | `@b-apm/integration-cursor`       | `.cursor/` или `.cursorrules`                                                        |
| Claude Code    | `claude`       | `@b-apm/integration-claude`       | `.claude/` или `CLAUDE.md`                                                           |
| Codex CLI      | `codex`        | `@b-apm/integration-codex`        | `.codex/`                                                                            |
| GitHub Copilot | `copilot`      | `@b-apm/integration-copilot`      | `.github/copilot-instructions.md` или `.github/{instructions,agents,prompts,hooks}/` |
| OpenCode       | `opencode`     | `@b-apm/integration-opencode`     | `.opencode/`, `opencode.json(c)`                                                     |
| Windsurf       | `windsurf`     | `@b-apm/integration-windsurf`     | `.windsurf/`                                                                         |
| Gemini CLI     | `gemini`       | `@b-apm/integration-gemini`       | `.gemini/` или `GEMINI.md`                                                           |
| Kiro           | `kiro`         | `@b-apm/integration-kiro`         | `.kiro/`                                                                             |
| Grok Build     | `grok-build`   | `@b-apm/integration-grok-build`   | `.grok/`                                                                             |
| Antigravity    | `antigravity`  | `@b-apm/integration-antigravity`  | нет, только `--target` или `active`                                                  |
| Agent Skills   | `agent-skills` | `@b-apm/integration-agent-skills` | нет, только `--target` или `active`                                                  |

`agent-skills` кладёт только skills в `.agents/skills/` и подходит для агентов, которые читают этот общий каталог, но своей интеграции не имеют.

Все интеграции в статусе раннего релиза, как и CLI.

## Куда попадают файлы {#layout}

| Агент       | Skills              | Rules / instructions    | MCP                                   | `bapm compile`                    |
| ----------- | ------------------- | ----------------------- | ------------------------------------- | --------------------------------- |
| Cursor      | `.agents/skills/`   | `.cursor/rules/`        | `.cursor/mcp.json`                    | `AGENTS.md`                       |
| Claude Code | `.claude/skills/`   | `.claude/rules/`        | `.mcp.json`                           | `CLAUDE.md`                       |
| Codex CLI   | `.agents/skills/`   | только через compile    | `.codex/config.toml`                  | `AGENTS.md`                       |
| Copilot     | `.agents/skills/`   | `.github/instructions/` | `~/.copilot/mcp-config.json`          | `.github/copilot-instructions.md` |
| OpenCode    | `.opencode/skills/` | только через compile    | `opencode.json`                       | `AGENTS.md`                       |
| Windsurf    | `.agents/skills/`   | `.windsurf/rules/`      | `~/.codeium/windsurf/mcp_config.json` | не поддерживается                 |
| Gemini CLI  | `.agents/skills/`   | только через compile    | `.gemini/settings.json`               | `GEMINI.md`                       |
| Kiro        | `.kiro/skills/`     | `.kiro/steering/`       | `.kiro/settings/mcp.json`             | `AGENTS.md`                       |
| Grok Build  | `.grok/skills/`     | `.grok/rules/`          | не поддерживается                     | `AGENTS.md`                       |
| Antigravity | `.agents/skills/`   | `.agents/rules/`        | `.agents/mcp_config.json`             | `AGENTS.md`                       |

Agents, commands и hooks раскладываются в каталог агента (`.cursor/agents/`, `.claude/commands/` и т. п.), если агент их поддерживает. Неподдерживаемый тип пропускается с предупреждением `bapm: warning: …` в `stderr` — см. ниже.

Skill раскладывается как полный каталог: `SKILL.md`, вспомогательные `.md`, скрипты и вложенные ассеты попадают в каталог skills агента. Для `SKILL.md` в корне пакета копируется только сам файл.

Обратите внимание:

- **Copilot и Windsurf пишут MCP в домашний каталог**, а не в проект: Copilot — `~/.copilot/mcp-config.json` (override `COPILOT_HOME`), Windsurf — `~/.codeium/windsurf/mcp_config.json` (override `CODEIUM_HOME`). Файл общий для всех проектов на машине: серверы с разными именами накапливаются, а одноимённый сервер перезаписывается последним `install`. После успешного configure install печатает `bapm: warning: …` с абсолютным путём этого файла. Чтобы не менять общий файл, исключите хосты из MCP: `bapm install --exclude copilot,windsurf` (эквивалентно `--exclude copilot --exclude windsurf`); остальная установка продолжится. Для изоляции также можно задать отдельный `COPILOT_HOME`/`CODEIUM_HOME` на проект или контейнер; проектный MCP эти интеграции не используют. В CI вместо списка исключений можно выставить `BAPM_NO_GLOBAL_MCP=1` — MCP configure для Copilot/Windsurf будет пропущен.
- **Claude Code, Gemini CLI, Kiro и Antigravity пишут MCP, только если каталог агента существует** (`.claude/`, `.gemini/`, `.kiro/`, `.agents/`). Каталог может создать и сам install, если пакеты приносят skills или rules. Если ставятся только MCP-серверы, а каталога нет, install печатает предупреждение `bapm: warning: …` с путём каталога: создайте каталог и повторите `install`.
- **Cursor, Codex, OpenCode, Kiro, Grok Build и Antigravity используют один `AGENTS.md`**. Если вы запускаете `compile` для нескольких из них, файл перезаписывает последний запуск.

Подробности по каждому агенту — в README его пакета на npm.

## Что каждый агент пропускает {#skipped}

Если в пакете есть тип файлов, который агент не поддерживает, install его не раскладывает и печатает предупреждение `bapm: warning: …` в `stderr`.

| Агент        | Не раскладывается | Особенности                                                            |
| ------------ | ----------------- | ---------------------------------------------------------------------- |
| Cursor       | —                 |                                                                        |
| Claude Code  | —                 |                                                                        |
| Copilot      | —                 | commands — в `.github/prompts/`                                        |
| Codex CLI    | commands          | instructions — только через `compile`                                  |
| OpenCode     | hooks             | instructions — только через `compile`                                  |
| Windsurf     | agents            | commands — в `.windsurf/workflows/`                                    |
| Gemini CLI   | agents            | commands — в `.gemini/commands/*.toml`; instructions — через `compile` |
| Kiro         | commands          |                                                                        |
| Grok Build   | hooks, prompts    | commands — в `.grok/commands/`                                         |
| Antigravity  | agents, commands  |                                                                        |
| Agent Skills | всё, кроме skills |                                                                        |

## Claude и Codex: маркетплейс

`@b-apm/integration-claude` и `@b-apm/integration-codex` умеют не только ставить пакеты в проект, но и собирать `marketplace.json` для публикации плагинов через `bapm pack`. Это отдельная задача: [Сборка маркетплейса](/guide/situations/marketplace-pack).

## Свой агент {#custom}

Если вашего агента нет в таблице или нужно изменить поведение стандартной интеграции, подключите свой модуль через `targets`:

```yaml
targets:
  x-acme-editor: "@acme/bapm-integration" # npm-пакет
  cursor: "./tools/my-cursor-integration" # замена стандартной, путь внутри проекта
active:
  target: x-acme-editor
```

Модуль экспортирует `createIntegration()` (или фабрику по умолчанию), которая возвращает объект с `id` (совпадает с ключом в `targets`), `deployRoots`, `detect` и `materialize`. Типы и хелперы — в пакете `@b-apm/integration-api`, пример реализации — `@b-apm/integration-cursor`.

Локальный путь должен указывать внутрь проекта.

`targets` не только подключает модуль, но и ограничивает раскладку: файлы получат только агенты из этого списка. Если в команде работают и в других агентах, перечислите в `targets` и их стандартные интеграции. См. [Агенты в манифесте](/guide/manifest-hosts#targets-и-target).

::: warning Интеграция — это исполняемый код
bapm запускает код интеграции без изоляции, как любую npm-зависимость. Подключайте только те интеграции, которым доверяете. Политика MCP, `approve` / `deny` и проверка хешей lock-файла на код интеграции не распространяются.
:::
