# bapm init — флаги

По `bapm init --help`.

## Использование

```text
bapm init [options] [project-name]
bapm init --discover [--json] [--apply]
```

Пишет только `bapm.yml`. Отказывается, если уже есть `apm.yml` или `bapm.yml`. Неизвестные флаги отвергаются. Scaffold plugin / marketplace в эту команду не входит.

## Параметры

| Флаг           | Значение | Эффект                                                                          | Default |
| -------------- | -------- | ------------------------------------------------------------------------------- | ------- |
| `-y`, `--yes`  | —        | Non-interactive defaults (`version: 0.1.0`)                                     | off     |
| `--target`     | `<id>`   | Активировать агента в `active` (например `cursor`)                              | —       |
| `--discover`   | —        | Показать существующий agent harness: хосты, skills, rules, commands, hooks, MCP | off     |
| `--json`       | —        | С `--discover`: стабильный JSON вместо текста                                   | off     |
| `--apply`      | —        | С `--discover`: создать `bapm.yml` из предложенных `active` (явное согласие)    | off     |
| `--help`, `-h` | —        | Показать help                                                                   | —       |

`--target` только закрепляет выбранного агента: `targets:` не создаётся, раскладка для остальных агентов не сужается. Для известных хостов bapm сам загружает `@b-apm/integration-<id>`; блок `target` / `targets` нужен только для своей или нестандартной интеграции.

Позиционный `project-name` задаёт `name` (иначе — имя каталога). С `--discover` позиционный аргумент и `--target` не принимаются.

## `--discover`: инвентаризация проекта {#discover}

`bapm init --discover` — read-only просмотр того, что уже настроено в проекте:

- каталоги и файлы-маркеры известных агентов (`.cursor/`, `.claude/`, `.codex/`, `CLAUDE.md`, `opencode.json` и т. д.);
- skills (`SKILL.md`, `.agents/skills/`, `.apm/skills/`, skills конкретных хостов);
- rules / instructions (`.cursor/rules/`, `.claude/rules/`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/instructions/` и т. д.);
- commands (`.cursor/commands/`, `.claude/commands/`, `.github/prompts/`, `.gemini/commands/` и т. д.);
- hooks (`hooks.json`, `settings.json` с `hooks`, каталоги hooks);
- MCP-конфиги (`.cursor/mcp.json`, `.mcp.json`, `.codex/config.toml`, `opencode.json`, `.kiro/settings/mcp.json` и т. д.).

Detected hosts определяются по тем же маркерам, что и `detect()` опубликованных интеграций, плюс локальные `.apm/`-примитивы через core discovery. Пакеты интеграций не загружаются, сеть не используется, файлы не пишутся.

```text
$ bapm init --discover
Manifest: (none)
Detected hosts:
  claude         .claude
  cursor         .cursor
Counts: skills=3 rules=2 commands=1 hooks=1 mcp=1
Suggested active: claude, cursor
No files were written (preview). Re-run with --apply to create bapm.yml.
```

`Suggested active` — это обнаруженные хосты, отсортированные по id. Это рекомендация, а не автоматическая запись.

### JSON

С `--json` печатается стабильный объект (`schemaVersion: 1`):

```json
{
  "schemaVersion": 1,
  "cwd": "/path/to/project",
  "manifest": { "exists": false, "path": null },
  "hosts": [{ "id": "claude", "markers": [".claude"] }],
  "suggestedActive": ["claude"],
  "inventory": {
    "skills": [{ "path": ".agents/skills/hello/SKILL.md", "host": null, "name": "hello" }],
    "rules": [],
    "commands": [],
    "hooks": [],
    "mcp": []
  },
  "counts": {
    "hosts": 1,
    "skills": 1,
    "rules": 0,
    "commands": 0,
    "hooks": 0,
    "mcp": 0
  },
  "applied": false
}
```

`manifest` описывает состояние на момент обнаружения. Для hooks и MCP `counts` считает найденные handlers / серверы, а не только файлы.

## `--apply`: создать манифест по результату

```bash
bapm init --discover --apply
```

`--apply` — явное согласие на запись. Команда:

- создаёт `bapm.yml` с `active` из `suggestedActive` и пустыми `dependencies`;
- ничего не удаляет и не перемещает: существующие `.cursor/`, `.claude/`, skills, hooks и MCP-конфиги остаются как есть;
- отказывается работать, если `bapm.yml` или `apm.yml` уже существует;
- если хосты не найдены, создаёт обычный минимальный `bapm.yml` без `active`.

`--apply` без `--discover` — ошибка. С `--json` после успешной записи в отчёте будет `"applied": true` и абсолютный `manifestPath`.

## См. также

- [Быстрый старт](/guide/quick-start#init)
- [Выбор агента](/guide/host-selection)
- [Поддерживаемые агенты](/guide/supported-hosts)
- [bapm.yml](/guide/config-manifest)
