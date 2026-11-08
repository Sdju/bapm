# bapm compile — флаги

По `bapm compile --help`.

## Использование

```text
bapm compile [-o PATH] [--target <id>] [--dry-run] [-v] [--validate]
```

Выбранный агент задаёт путь по умолчанию и состав файла: `AGENTS.md` (Cursor, Codex, OpenCode, Kiro, Grok Build, Antigravity; последний запуск перезаписывает файл), `CLAUDE.md`, `.github/copilot-instructions.md`, `GEMINI.md`. Windsurf compile не поддерживает. Что попадает в файл у каждого агента: [Собрать AGENTS.md](/guide/situations/compile-agents#contents). Нужен `bapm.yml` в текущем каталоге. Неизвестные флаги отвергаются.

::: warning Общий `AGENTS.md`
Cursor, Codex, OpenCode, Kiro, Grok Build и Antigravity используют один и тот же `AGENTS.md`. `bapm compile` пишет один файл за запуск, поэтому сборка для другого агента из этого списка перезапишет предыдущий файл. Чтобы сохранить оба результата, задайте разные пути через `-o` (для Codex, OpenCode и Grok Build имя файла должно остаться `AGENTS.md`).
:::

## Параметры

| Флаг              | Значение | Эффект                                                                                             | Default                                |
| ----------------- | -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `-o`, `--output`  | `PATH`   | Другой путь. Для Codex, OpenCode, Grok Build имя должно быть `AGENTS.md`, для Gemini — `GEMINI.md` | путь агента                            |
| `--target`        | `<id>`   | Force host (перекрывает `active`; обязателен при multi-`active` или неоднозначном detect)          | `active` (sole) → config → auto-detect |
| `--dry-run`       | —        | Превью would-write path; не писать файл                                                            | off                                    |
| `-v`, `--verbose` | —        | Thin source attribution (name, type, path)                                                         | off                                    |
| `--validate`      | —        | Только discover/validate; не писать                                                                | off                                    |
| `--help`, `-h`    | —        | Показать help                                                                                      | —                                      |

`--dry-run` и `--validate` не пишут выходной файл.

Выбор host: `--target` → sole манифест `active` → `target` из `~/.bapm/config.json` → sole auto-detect → fail. Multi-`active` без `--target` — ошибка (compile остаётся single-host).

Сценарий: [Собрать AGENTS.md](/guide/situations/compile-agents).
