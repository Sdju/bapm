# Hooks и canvas не под ExecutableTrust

**Статус:** намеренно  
**Класс:** намеренное отличие / soft security

## Суть

Разрешения `executables` и флаги `--trust-bin` закрывают MCP и `bin/`. Хуки пакета и canvas ставятся без grant.

## Состояние

| Источник       | Позиция                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| APM            | Approve UX шире (в т.ч. recommended/all); hooks не обязательно в той же лестнице.                                      |
| OpenAPM sc-009 | Executable governance; bapm заявляет MCP + bin, не hooks/canvas.                                                       |
| Спека bapm     | `executable-mcp-trust`: hooks/canvas ungated. Change `sync-specs` переписывает требование с «текст docs» на поведение. |
| Код bapm       | Materialize hooks не зовёт `resolveExecutableTrust`.                                                                   |
| Документация   | `guide/conformance.md`, `CONFORMANCE.md` limitations.                                                                  |

## Вариации

1. Распространить лестницу на hooks/canvas.
2. Оставить soft (текущее) и честно писать в conformance.
3. Заявлять полный APM approve — не сделано (`--all` / `--recommended` / policy explain — soft).

## Поведение сейчас

Пакет с hook раскладывает его даже если в `executables.allow` его нет. `bin/` в non-interactive без grant и без `--trust-bin` не раскладывается. См. [trust-bin-interactive.md](./trust-bin-interactive.md).
