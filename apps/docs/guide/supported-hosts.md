# Поддерживаемые hosts и кастомные интеграции

Куда `bapm install` / `bapm compile` раскладывают пакеты. Поля манифеста: [Hosts и target](/guide/manifest-hosts).

| Host             | В CLI                 | Как подключить                                                                                                                                           |
| ---------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cursor**       | Нет (отдельный пакет) | Установить `@bapm/integration-cursor`, объявить `targets:`, затем `--target cursor` / `active`                                                           |
| **OpenCode**     | Нет (отдельный пакет) | Установить `@bapm/integration-opencode`, объявить `targets:`, затем `--target opencode` / `active`                                                       |
| **Copilot**      | Нет (отдельный пакет) | Установить `@bapm/integration-copilot`, объявить `targets:`, затем `--target copilot` / `active`                                                         |
| **Windsurf**     | Нет (отдельный пакет) | Установить `@bapm/integration-windsurf`, объявить `targets:`, затем `--target windsurf` / `active`                                                       |
| **Kiro**         | Нет (отдельный пакет) | Установить `@bapm/integration-kiro`, объявить `targets:`, затем `--target kiro` / `active`                                                               |
| **Grok Build**   | Нет (отдельный пакет) | Установить `@bapm/integration-grok-build`, объявить `targets:`, затем `--target grok-build` / `active`                                                   |
| **Antigravity**  | Нет (отдельный пакет) | Установить `@bapm/integration-antigravity`, объявить `targets:`, затем **явный** `--target antigravity` / `active` (без auto-detect)                     |
| **Agent Skills** | Нет (отдельный пакет) | Установить `@bapm/integration-agent-skills`, объявить `targets:`, затем **явный** `--target agent-skills` / `active` (без auto-detect)                   |
| **Свой агент**   | Нет                   | npm-пакет или локальный модуль + `targets:` / `target:` object-map                                                                                       |
| **Claude**       | Нет (отдельный пакет) | Установить `@bapm/integration-claude`, объявить `targets:`, затем `--target claude` / `active`; marketplace — [pack](/guide/situations/marketplace-pack) |
| **Codex**        | Нет (отдельный пакет) | Установить `@bapm/integration-codex`, объявить `targets:`, затем `--target codex` / `active`; marketplace — [pack](/guide/situations/marketplace-pack)   |

## Cursor (opt-in пакет)

CLI не регистрирует Cursor сам. Поставьте пакет и объявите object-map:

```bash
npm i -g @bapm/cli @bapm/integration-cursor
# или в проекте: npm i -D @bapm/integration-cursor
```

```yaml
targets:
  cursor: "@bapm/integration-cursor"
active:
  - cursor
```

```bash
bapm init -y --target cursor   # пишет targets: + active
bapm install --target cursor
```

Без `--target` CLI может опереться на auto-detect (`.cursor/` / `.cursorrules`) или на `active` — но только после успешной загрузки map.

**Commands / hooks:** `.apm/prompts/*.prompt.md` и root `*.prompt.md` → `.cursor/commands/<name>.md` (Claude-subset frontmatter); `.apm/hooks/*.json` / `hooks/*.json` → merge `.cursor/hooks.json` со скриптами под `.cursor/hooks/` и sidecar ownership `.cursor/bapm-hooks.json`. MCP через `configureMcp`, не через materialize.

## OpenCode (opt-in пакет)

Аналогично Cursor — отдельный runtime-пакет `@bapm/integration-opencode`:

```bash
npm i -D @bapm/integration-opencode
```

```yaml
targets:
  opencode: "@bapm/integration-opencode"
active:
  - opencode
```

```bash
bapm init -y --target opencode
bapm install --target opencode
```

Skills → `.opencode/skills/<name>/SKILL.md`, agents → `.opencode/agents/<name>.md`, commands → `.opencode/commands/<name>.md`, hooks — явный non-fatal skip (diagnostic), MCP → project `opencode.json` (`mcp`, `type: local` / `remote`). Auto-detect: `.opencode/` или `opencode.json` / `opencode.jsonc`.

## Copilot (opt-in пакет)

Отдельный runtime-пакет `@bapm/integration-copilot`:

```bash
npm i -D @bapm/integration-copilot
```

```yaml
targets:
  copilot: "@bapm/integration-copilot"
active:
  - copilot
```

```bash
bapm init -y --target copilot
bapm install --target copilot
bapm compile --target copilot
```

Instructions → `.github/instructions/<name>.instructions.md`, commands/`*.prompt.md` → `.github/prompts/<name>.prompt.md` (не `.github/commands/`), agents → `.github/agents/<name>.agent.md`, skills → `.agents/skills/<name>/`, hooks → per-file `.github/hooks/<pkg>-<stem>.json` (+ scripts и sidecar `.github/bapm-hooks.json`). MCP → home `~/.copilot/mcp-config.json` (`COPILOT_HOME`, translate-placeholders `${VAR}`), compile → `.github/copilot-instructions.md` (instructions из materialize в тело compile не дублируются). Auto-detect: whitelist под `.github/` (`copilot-instructions.md` или dirs instructions/agents/prompts/hooks).

## Windsurf (opt-in пакет)

Отдельный runtime-пакет `@bapm/integration-windsurf`:

```bash
npm i -D @bapm/integration-windsurf
```

```yaml
targets:
  windsurf: "@bapm/integration-windsurf"
active:
  - windsurf
```

```bash
bapm init -y --target windsurf
bapm install --target windsurf
```

Instructions → `.windsurf/rules/<name>.md`, commands → `.windsurf/workflows/<name>.md` (не `.windsurf/commands/`), skills → `.agents/skills/<name>/`, hooks → merge `.windsurf/hooks.json` (+ scripts и sidecar `.windsurf/bapm-hooks.json`, PascalCase events). Agents — skip (diagnostic). MCP → home `~/.codeium/windsurf/mcp_config.json` (`CODEIUM_HOME`, bake/default). Auto-detect: каталог `.windsurf/`. User-scope / `global_rules` — вне scope этого пакета.

## Кастомный npm-пакет

1. Поставьте пакет интеграции (глобально рядом с CLI или в проекте — как принято у вас для зависимостей).
2. Объявите object-map и активируйте host:

```yaml
targets:
  x-acme-editor: "@acme/my-integration"
active:
  - x-acme-editor
```

```bash
bapm install --target x-acme-editor
```

Значения без `./` / `../` / абсолютного пути трактуются как **npm package specifier** (`@scope/name`, `pkg@version`).

## Локальный модуль или скрипт

Путь относительно корня проекта (обязан оставаться внутри project root):

```yaml
targets:
  pi: "./agents/integration/pi-agent"
```

```bash
bapm install --target pi
```

Директория резолвится через Node (`exports` / `main` / `index.*`); можно указать явный `.js` / `.mjs` / `.cjs`.

### Минимальный контракт

Модуль должен экспортировать (первое совпадение):

1. именованный **`createIntegration()`** — без аргументов, возвращает интеграцию; или
2. именованный factory вроде `createCursorIntegration`; или
3. **default export** — объект интеграции или factory.

У экземпляра обязательны непустые:

| Поле          | Смысл                                              |
| ------------- | -------------------------------------------------- |
| `id`          | Должен совпадать с ключом в `targets:` / `target:` |
| `deployRoots` | Массив корней деплоя                               |
| `detect`      | Функция автодетекта host                           |
| `materialize` | Запись примитивов на диск                          |

`configureMcp` / `compile` — опционально. Пакеты только для marketplace-output (без runtime hooks) как значение map для install/compile **отклоняются**.

Контракт и helpers: пакет `@bapm/integration-api`. Глубокий authoring: [Architecture](/architecture/).

## Claude (opt-in runtime + marketplace)

Аналогично Cursor — отдельный пакет `@bapm/integration-claude` даёт **runtime** install/compile и отдельно marketplace pack:

```bash
npm i -D @bapm/integration-claude
```

```yaml
targets:
  claude: "@bapm/integration-claude"
active:
  - claude
```

```bash
bapm install --target claude
bapm compile --target claude
```

Skills → `.claude/skills/<name>/SKILL.md`, instructions → `.claude/rules/<name>.md`, agents → `.claude/agents/`, commands → `.claude/commands/`, hooks → `.claude/settings.json` (+ `.claude/bapm-hooks.json`), MCP → project `.mcp.json` (opt-in when `.claude/` exists), compile → `CLAUDE.md`. Auto-detect: `.claude/` или `CLAUDE.md`.

Marketplace JSON по-прежнему:

```bash
bapm pack --marketplace claude
```

## Codex (opt-in runtime + marketplace)

Отдельный пакет `@bapm/integration-codex` даёт **runtime** install/compile и marketplace pack:

```bash
npm i -D @bapm/integration-codex
```

```yaml
targets:
  codex: "@bapm/integration-codex"
active:
  - codex
```

```bash
bapm install --target codex
bapm compile --target codex
```

Skills → `.agents/skills/<name>/SKILL.md`, agents → `.codex/agents/<name>.toml`, hooks → `.codex/hooks.json` (+ `.codex/bapm-hooks.json`), MCP → `.codex/config.toml` (`mcp_servers`), compile → project-root `AGENTS.md` (**включая** instructions). Auto-detect: только `.codex/` (lone `AGENTS.md` не считается Codex).

Cursor и Codex делят compile family `AGENTS.md`: **last writer wins** на вызов — предпочитайте один активный compile target.

Marketplace JSON по-прежнему:

```bash
bapm pack --marketplace codex
```

Сценарий pack: [Marketplace pack](/guide/situations/marketplace-pack).

## Типичные ошибки

| Симптом                                    | Что проверить                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `Unknown or unregistered target`           | Пакет установлен? Id объявлен в object-map `targets:`?                      |
| `Target detection is missing or ambiguous` | `--target <id>` или `active: […]`                                           |
| Отказ загрузки map                         | Пакет/путь, `createIntegration`, совпадение `id` с ключом, containment пути |

Дальше: [Hosts и target](/guide/manifest-hosts) · [Быстрый старт](/guide/quick-start).
