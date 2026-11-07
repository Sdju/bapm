# Запечённые секреты в lock

**Статус:** исправлено (working tree, change `fix-install-safety`)  
**Класс:** баг

## Суть

Bake подставляет `${GITHUB_TOKEN}` в объект сервера перед записью в агента. Тот же объект раньше уходил в `bapm.lock.yaml`. Lock предназначен для коммита.

## Состояние

| Источник     | Позиция                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| APM          | Lock хранит декларации MCP, не runtime secrets.                                                                |
| OpenAPM      | Lock — пины и inventory, не секреты.                                                                           |
| Спека bapm   | ADDED `mcp-env-bake`: baked values MUST NOT persist in the lockfile.                                           |
| Код bapm     | `applyMcpInventoryToLock({ servers: approved })` — authored (до bake), не `configuredServers`.                 |
| Документация | `manifest-dependencies.md`: lock с `${VAR}`; агент — с значениями. Старые lock — re-install + ротация токенов. |

## Вариации

1. Писать bake в lock (старое).
2. Писать placeholders (текущее).
3. Не писать MCP inventory в lock вовсе.

## Поведение сейчас

В lock: `GITHUB_TOKEN: ${GITHUB_TOKEN}`. В `.cursor/mcp.json`: настоящее значение (кроме Kiro/Copilot, которые оставляют `${VAR}` для env, но `{bake:VAR}` подставляют). Уже закоммиченные секреты генератор не вычищает — нужен повторный install и смена токенов. Конфиг агента по-прежнему секрет.
