# Plugin CLI: `--agent-plugins` / `--skills` vs спека

**Статус:** открыто  
**Класс:** долг спеки  
**Важность:** низкая — флаги работают, покрыты CLI-тестами и docs; расхождение только со спекой `cli-plugin-init`, которая их не описывает.  
**Проверено:** 08-11-2026, working tree

## Суть

`bapm plugin init` умеет два режима. Обычный APM-совместимый scaffold пишет `plugin.json` и `bapm.yml` и принимает `--target <id>`, записывая `target: <id>`. Режим `--agent-plugins` создаёт переносимый Agent Plugins v1 root: только `plugin.json`, без `bapm.yml`; `--skills` добавляет минимальный `skills/example/SKILL.md`. Комбинация `--agent-plugins` с `--target` запрещена.

Спека `cli-plugin-init` описывает только первый режим: `--target`, `-v`, два файла и прямой запрет создавать `SKILL.md`/`skills/`. Пары `--agent-plugins` / `--skills` в ней нет. Пользовательская документация при этом уже описывает оба режима, а CLI-тесты закрепляют портируемый scaffold.

Практический риск не в runtime, а в spec-first работе: агент, читающий только `cli-plugin-init`, «починит» несуществующее расхождение — удалит флаги или снова предложит тонкий `bapm-target-*` scaffold. Исходная карточка также упоминала тонкие `bapm-target-*`; в `cli-plugin-init` их нет, а в `core-feod-architecture` они остаются только как negative-запрет.

## Влияние

- **Сценарий:** автор плагина хочет portable Agent Plugins v1 и выполняет `bapm plugin init --agent-plugins --skills my-plugin`; спека говорит, что такого режима нет.
- **Кого задевает:** автор пакета/плагина, агент-реализатор, ревьюер docs-vs-spec.
- **Последствие:** спека и help расходятся; возможна реализация «по спеке», ломающая уже shipped UX и тесты `plugin-init.test.ts`.
- **Частота:** только при создании плагинов; не затрагивает install/lock.
- **Обходной путь:** `apps/docs/reference/plugin.md` и `guide/agent-plugins.md` описывают актуальные флаги.

## Состояние

| Источник     | Позиция                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| APM          | Свой plugin scaffold.                                                                         |
| OpenAPM      | Agent plugins — отдельный артефакт.                                                           |
| Спека bapm   | `cli-plugin-init`: `--target`, `-v`, два файла; пары `--agent-plugins` / `--skills` нет.      |
| Код bapm     | `runPlugin.ts`: флаги есть; `--target` пишет `target: <id>`; с `--agent-plugins` несовместим. |
| Документация | `reference/plugin.md`, `guide/agent-plugins.md` — оба режима описаны.                         |
| Тесты        | `packages/cli/tests/plugin/plugin-init.test.ts` — portable root и `--skills` закреплены.      |

## Проверка

| Артефакт | Где смотреть                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/cli/src/modules/Plugin/services/runPlugin.ts:40-42` — help: `--target`, `--agent-plugins`, `--skills`.      |
| Код      | `runPlugin.ts:176` — `--target` + `--agent-plugins` → ошибка, exit 1.                                                 |
| Код      | `runPlugin.ts:241-243` — `--skills` создаёт `skills/example/SKILL.md`; `:260` — `target` пишется в манифест.          |
| Спека    | `openspec/specs/cli-plugin-init/spec.md:79-86` — только `--target`; `:28-31` — запрет создавать `SKILL.md`/`skills/`. |
| Docs     | `apps/docs/reference/plugin.md:22-24` — таблица флагов; `apps/docs/guide/agent-plugins.md:20` — пример команды.       |
| Тесты    | `packages/cli/tests/plugin/plugin-init.test.ts:234`, `:255`, `:275` — portable root, skills layout, несовместимость.  |

Воспроизведение:

```bash
mkdir -p /tmp/bapm-plugin && cd /tmp/bapm-plugin
bapm plugin init --agent-plugins --skills demo
find demo -type f
bapm plugin init --yes --target cursor --agent-plugins demo2
```

Ожидание по `cli-plugin-init`: единственный scaffold — `plugin.json` + `bapm.yml`, без `skills/`.  
Факт: первый вызов создаёт `plugin.json` и `skills/example/SKILL.md` (exit 0); второй — `--target is an APM scaffold option and cannot be used with --agent-plugins` (exit 1).

## Вариации

1. Дописать `cli-plugin-init` под shipped флаги и два режима — рекомендуется.
2. Убрать флаги — ломает docs и тесты, уже shipped UX.
3. Держать спеку тонкой — агент снова предложит `bapm-target-*` или удалит portable scaffold.

## Рекомендация

Вариант 1. Добавить в `cli-plugin-init` требование и сценарии для `--agent-plugins` / `--skills`, зафиксировать несовместимость с `--target` и отсутствие `bapm.yml` в portable-режиме; в требовании о двух файлах явно ограничить его обычным режимом. Оценка S (полдня).

Критерии закрытия:

- [ ] `cli-plugin-init` описывает оба режима и их флаги.
- [ ] Сценарий «portable root не создаёт `bapm.yml`» и «`--target` несовместим» добавлены.
- [ ] `openspec validate --strict` зелёный, docs/тесты не меняются.

## Поведение сейчас

`--target <id>` пишет `target: <id>` и ограничивает деплой. Нельзя вместе с `--agent-plugins`. `--agent-plugins` создаёт canonical `plugin.json`; `--skills` добавляет `skills/example/SKILL.md`. Канонические хосты подхватываются пакетом интеграции, не тонким `bapm-target-*`.

## Связанные

- [stale-specs-compile-and-cursor.md](./stale-specs-compile-and-cursor.md) — общий класс «спека отстала от shipped CLI».
- `init --target` больше не пишет сужающий `targets` (исправлено).
