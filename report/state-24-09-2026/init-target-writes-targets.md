# `init --target` пишет сужающий `targets:`

**Статус:** открыто  
**Класс:** продукт

## Суть

Человек вызывает `bapm init --target cursor`, чтобы закрепить агента. Команда пишет ещё и `targets:`, который потом молча отрезает остальных агентов. См. [targets-narrow-deploy.md](./targets-narrow-deploy.md).

## Состояние

| Источник     | Позиция                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| APM          | Init ближе к одному host hint / active, без object-map интеграций.                                        |
| OpenAPM      | `targets` map — регистрация пакетов интеграций, не выбор active.                                          |
| Спека bapm   | `producer-init` / plugin init: `--target` пишет `target:` / `targets:`. Help недавно пояснил ограничение. |
| Код bapm     | `packages/cli/src/modules/Init` пишет `targets:` с каноническим пакетом выбранного id.                    |
| Документация | `guide/host-selection.md`: «если в команде больше одного агента, удалите блок».                           |

## Вариации

1. Писать только `active: { target: <id> }` — выбор без фильтра intersection.
2. Писать `targets:` (текущее) — один агент «навсегда», пока блок не сотрут.
3. Писать оба, но help/init note обязан предупреждать (частично сделано в help).

## Поведение сейчас

После `init --target cursor` манифест содержит и `active`, и `targets: { cursor: … }`. Позже `install --target claude` или `active: { target: [cursor, claude] }` разложит Claude без файлов, если `claude` не добавлен в `targets`.
