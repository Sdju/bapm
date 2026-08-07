# bapm compile — флаги

По `bapm help compile`.

## Использование

```text
bapm compile [-o PATH] [--target <id>] [--dry-run] [-v] [--validate]
```

Выбранный target задаёт default output path и rendering. Сегодня runtime-хост для материализации — **cursor** (типичный вывод — `AGENTS.md`). Неизвестные флаги отвергаются.

## Параметры

| Флаг | Значение | Эффект | Default |
| --- | --- | --- | --- |
| `-o`, `--output` | `PATH` | Переопределить default output path target | path target |
| `--target` | `<id>` | Обязателен, если auto-detect отсутствует или неоднозначен (например `cursor`) | auto-detect |
| `--dry-run` | — | Превью would-write path; не писать файл | off |
| `-v`, `--verbose` | — | Thin source attribution (name, type, path) | off |
| `--validate` | — | Только discover/validate; не писать | off |
| `--help`, `-h` | — | Показать help | — |

`--dry-run` и `--validate` не пишут выходной файл.

Сценарий: [US-05 Compile AGENTS.md](/guide/situations/compile-agents).
