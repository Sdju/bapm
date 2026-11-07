# Команды `mcp` нет, есть `approve` / `deny`

**Статус:** намеренно  
**Класс:** долг спеки / CLI surface

## Суть

Часть `cli-runtime-surface` и старых текстов ещё говорит о команде `mcp` или «in this change». У пользователя: `bapm approve`, `bapm deny`, `bapm policy`.

## Состояние

| Источник     | Позиция                                                       |
| ------------ | ------------------------------------------------------------- |
| APM          | Интерактивный approve ближе к `apm` подкомандам policy/mcp.   |
| OpenAPM      | Не фиксирует имя бинаря.                                      |
| Спека bapm   | Смесь: approve/deny shipped; упоминания `mcp` и milestone M8. |
| Код bapm     | Отдельных `bapm mcp` нет.                                     |
| Документация | `guide/commands.md`, reference approve/deny/policy.           |

## Вариации

1. Добавить алиас `bapm mcp` — не нужно для UX.
2. Вычистить спеку.
3. Оставить — агент реализует мёртвую команду.

## Поведение сейчас

Разрешение: `bapm approve <pkg>` → `~/.bapm/config.json`. Запрет: `bapm deny`. Командный allow: YAML `executables`. Интерактивный полный APM UX (`--all`, `--recommended`, policy explain) не заявлен.
