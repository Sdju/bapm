# bapm compile — флаги

По `bapm compile --help`.

## Использование

```text
bapm compile [-o PATH] [--target <id>[,<id>…]] [--all] [--dry-run] [-v] [--validate]
```

Выбранный агент задаёт путь по умолчанию и состав файла: `AGENTS.md` (Cursor, Codex, OpenCode, Kiro, Grok Build, Hermes, Antigravity), `CLAUDE.md`, `.github/copilot-instructions.md`, `GEMINI.md`. Windsurf, Grok Bot и IntelliJ compile не поддерживают. Что попадает в файл у каждого агента: [Собрать AGENTS.md](/guide/situations/compile-agents#contents). Нужен `bapm.yml` в текущем каталоге. Неизвестные флаги отвергаются.

`--target cursor,claude` и `--all` собирают несколько файлов за один запуск. `--all` берёт все зарегистрированные хосты с поддержкой compile.

::: warning Общий `AGENTS.md`
Cursor, Codex, OpenCode, Kiro, Grok Build, Hermes и Antigravity используют один и тот же `AGENTS.md`. Если среди выбранных хостов несколько пишут в один путь, `bapm compile` завершается ошибкой и перечисляет хосты и путь — файл не перезаписывается. Выберите по одному хосту на путь: `--target cursor`, затем отдельный запуск с `-o` или другим хостом.
:::

## Параметры

| Флаг              | Значение       | Эффект                                                                                                                                          | Default                                |
| ----------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `-o`, `--output`  | `PATH`         | Другой путь. Только для одного выбранного хоста. Для Codex, OpenCode, Grok Build и Hermes имя должно быть `AGENTS.md`, для Gemini — `GEMINI.md` | путь агента                            |
| `--target`        | `<id>[,<id>…]` | Force host или список хостов через запятую (перекрывает `active`)                                                                               | `active` (sole) → config → auto-detect |
| `--all`           | —              | Собрать для всех зарегистрированных compile-capable хостов                                                                                      | off                                    |
| `--dry-run`       | —              | Превью всех would-write путей; не писать файлы                                                                                                  | off                                    |
| `-v`, `--verbose` | —              | Thin source attribution (name, type, path)                                                                                                      | off                                    |
| `--validate`      | —              | Только discover/validate; не писать                                                                                                             | off                                    |
| `--help`, `-h`    | —              | Показать help                                                                                                                                   | —                                      |

`--dry-run` и `--validate` не пишут выходные файлы. В multi-target режиме `--dry-run` печатает по строке на каждый хост.

Выбор host: `--target` / `--all` → sole манифест `active` → `target` из `~/.bapm/config.json` → sole auto-detect → fail. Multi-`active` без `--target` — ошибка. `--target` и `--all` взаимоисключающие. `-o` нельзя сочетать с несколькими хостами: один путь не может быть общим для разных хостов.

`grok-bot`, `hermes` и `intellij` — explicit-only; у `intellij` нет `compile`, поэтому `--target intellij` завершается диагностикой, а не записью файла.

::: tip Collision policy
Перед записью compile вычисляет пути всех выбранных хостов. Если два хоста претендуют на один путь (например, `AGENTS.md`), запуск падает с диагностикой вида `Compile target collision: hosts "cursor", "codex" all write "AGENTS.md"` и ничего не пишет. Молчаливой перезаписи нет.
:::

Сценарий: [Собрать AGENTS.md](/guide/situations/compile-agents).
