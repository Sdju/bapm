# Архитектура

Обзор для тех, кто хочет разобраться в коде bapm или внести изменения. Как пользоваться bapm в своём проекте: [Руководство](/guide/).

## Пакеты

| Пакет                     | Каталог                    | Что внутри                                                  |
| ------------------------- | -------------------------- | ----------------------------------------------------------- |
| `@b-apm/core`             | `packages/core`            | Манифест, lock, разрешение зависимостей, install, политика  |
| `@b-apm/cli`              | `packages/cli`             | Команда `bapm`: разбор аргументов и вывод поверх `core`     |
| `@b-apm/integration-api`  | `packages/integration-api` | Контракт между `core` и интеграциями агентов                |
| `@b-apm/integration-<id>` | `packages/integration-*`   | Интеграции агентов: Cursor, Claude, Codex, Copilot и другие |
| `@b-apm/docs`             | `apps/docs`                | Этот сайт (VitePress)                                       |

## Как устроены интеграции

CLI не содержит кода агентов. При `install` и `compile` он:

1. берёт id агентов из `targets` в манифесте и из списка известных id;
2. загружает для каждого модуль: из `targets`, иначе стандартный `@b-apm/integration-<id>` из проекта или глобальных пакетов;
3. выбирает агента по `--target`, `active` или `detect()` интеграции;
4. передаёт интеграции разрешённые пакеты, и она раскладывает файлы в свои `deployRoots`.

Интеграция экспортирует `createIntegration()` и реализует `detect`, `materialize`, при необходимости `configureMcp` и `compile`. Контракт описан в README `@b-apm/integration-api`; самая полная реализация — `@b-apm/integration-cursor`.

`@b-apm/integration-claude` и `@b-apm/integration-codex` дополнительно экспортируют генераторы `marketplace.json`, которые использует `bapm pack`.

Пути, которые использует каждая интеграция: [Поддерживаемые агенты](/guide/supported-hosts#layout). Границы совместимости с OpenAPM: [Совместимость](/guide/conformance).

## Сборка из исходников

```bash
pnpm install
pnpm run -r build
node packages/cli/dist/cli.mjs --help
```
