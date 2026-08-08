# bapm compile — флаги

По `bapm help compile`.

## Использование

```text
bapm compile [-o PATH] [--target <id>] [--dry-run] [-v] [--validate]
```

Выбранный target задаёт default output path и rendering. Cursor и Codex делят family `AGENTS.md` (last-writer-wins на вызов); Claude — `CLAUDE.md`. Неизвестные флаги отвергаются.

## Параметры

| Флаг              | Значение | Эффект                                                                                    | Default                       |
| ----------------- | -------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| `-o`, `--output`  | `PATH`   | Переопределить default output path target                                                 | path target                   |
| `--target`        | `<id>`   | Force host (перекрывает `active`; обязателен при multi-`active` или неоднозначном detect) | `active` (sole) → auto-detect |
| `--dry-run`       | —        | Превью would-write path; не писать файл                                                   | off                           |
| `-v`, `--verbose` | —        | Thin source attribution (name, type, path)                                                | off                           |
| `--validate`      | —        | Только discover/validate; не писать                                                       | off                           |
| `--help`, `-h`    | —        | Показать help                                                                             | —                             |

`--dry-run` и `--validate` не пишут выходной файл.

Выбор host: `--target` → sole манифест `active` → sole auto-detect → fail. Multi-`active` без `--target` — ошибка (compile остаётся single-host).

Техдолг паритета с APM compile (не заявлен): `TD-COMPILE-*` — см. [US-05](/guide/situations/compile-agents#техдолг-vs-apm).

Сценарий: [US-05 Compile AGENTS.md](/guide/situations/compile-agents).
