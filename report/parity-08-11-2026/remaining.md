# Актуальный остаток паритета (09.11.2026)

Это **замороженный** список после серии правок. Обновлено 09.11.2026. Новые пункты сюда не добавляются без отдельного product-решения: найденный «риск» сначала классифицируется как actionable, follow-up или N/A.

## Actionable — 4 пункта

| #   | Пункт                                                                                  | Почему остаётся                                                                 | Оценка |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| 1   | **User-scope/global install** (`-g`, user manifest/lock, user MCP для Cursor/OpenCode) | Крупный отдельный change; затрагивает lock-модель и все интеграции              | L      |
| 2   | **Registry MCP lookup** (`registry:` entry → MCP registry, `mcp install`)              | Нужен registry-клиент и сетевая политика; сейчас fail-closed                    | M      |
| 3   | **LSP deploy + trust**                                                                 | Нужны per-host форматы и `lsp` executable type; сейчас только `LSP_UNSUPPORTED` | L      |
| 4   | **Compile `--watch`**                                                                  | Build ID, `--clean`, multi-target и `applyTo` уже есть; остался watch           | M      |

## Исправлено в последней пачке

- annotated tag `source.sha` → peeled commit (`1eb454f`)
- deterministic Build ID + `compile --clean` (`7dad385`)
- shared HTTP cache (`bapm cache info/clean/prune --shared`) (`308281c`)

## Follow-up после уже сделанных фиксов

Это не «новые дыры», а явно отложенные части уже принятых решений:

- `config temp-dir` / `self-update.channel` / `mcp-registry-url` — stored-only, потребителей пока нет.
- `runtime setup/remove` — status/list сделаны, управление средами отложено.
- `view -g` — зависит от user-scope.
- `lifecycle:` — сейчас warning; executor требует trust-модели.
- `experimental` — есть env-флаг, нет CLI-группы.
- `mcp install` — read-only list/show/search сделаны.
- Canvas — primitive path отсутствует; держим explicit diagnostic.

## Намеренно не делаем / N/A

- **resolve**: bapm ∩-pick (OpenAPM) vs APM first-wins — осознанный diverge.
- **lock sort**: `(repo_url, virtual_path)` vs depth — осознанное отличие.
- **full `replace:` и manifest-v0.1.48** — контракты APM не ratified.
- **registry host** — bapm не заявляет серверную роль.
- **approve/deny project-default** — bapm сознательно user-local (sc-010); project allow задаётся в `bapm.yml`.
- **`unpack`, APM installer/Homebrew/Authenticode, gh-aw, contributor dashboard** — вне продукта.
- **APM `experimental` UX** — env-флага достаточно до появления второго флага.

## Правило поддержания

1. Новый пункт попадает в Actionable только с product-решением и оценкой.
2. Всё, что появилось как «risk» в отчёте субагента, сначала классифицируется, а не автоматически становится «Осталось».
3. Fixed-пункты удаляются из Actionable в том же change, а не остаются в P2-таблице.
