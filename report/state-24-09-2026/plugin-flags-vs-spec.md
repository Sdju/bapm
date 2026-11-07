# Plugin CLI: `--agent-plugins` / `--skills` vs спека

**Статус:** открыто  
**Класс:** долг спеки

## Суть

`bapm plugin init` принимает `--agent-plugins` и `--skills`. Спеки plugin/init их не описывают или описывают тонкий `bapm-target-*`. `--target` несовместим с `--agent-plugins` и пишет сужающий `target:`.

## Состояние

| Источник     | Позиция                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| APM          | Свой plugin scaffold.                                                                                   |
| OpenAPM      | Agent plugins — отдельный артефакт.                                                                     |
| Спека bapm   | Plugin/producer-init: `--target`, иногда retired `bapm-target-*`. Нет пары флагов agent-plugins/skills. |
| Код bapm     | `packages/cli/src/modules/Plugin/services/runPlugin.ts`: флаги есть; help обновлён.                     |
| Документация | `reference/plugin.md`, `guide/agent-plugins.md`.                                                        |

## Вариации

1. Дописать спеку под shipped флаги.
2. Убрать флаги — ломает уже описанный UX.
3. Держать спеку тонкой — агент снова предложит `bapm-target-*`.

## Поведение сейчас

`--target <id>` пишет `target: <id>` и ограничивает деплой. Нельзя вместе с `--agent-plugins`. Канонические хосты подхватываются пакетом интеграции, не тонким `bapm-target-*`.
