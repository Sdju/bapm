# FEOD — справочник (CLI, locked)

Профиль: `packages/cli`, base, `pages` → `commands`. Vue/SPA/multiapp/commonless — N/A.

## Матрица cross-level импортов

| Импортирует ↓ / из → | global | common | modules | commands | app |
|----------------------|--------|--------|---------|----------|-----|
| **global** | — | ❌ | ❌ | ❌ | ❌ |
| **common** | ✅* | ✅ | ❌** | ❌ | ❌ |
| **modules** | ✅* | ✅ | ✅ (public API) | ❌ | ❌ |
| **commands** | ✅* | ✅ | ✅ (public API) | ❌ | ❌ |
| **app** | ✅* | ✅ | ✅ (public API) | ✅ | ❌ |

\* global не импортируется — сущности через tsconfig / entry init  
\*\* common → modules только через IoC (интерфейс, реализация в app)

## Правила путей

| Тип импорта | Путь |
|-------------|------|
| Cross-level | `@/common/utilities/formatPath` |
| Cross-module | `@/modules/Install` (→ index.ts) |
| In-level (commands) | `./help` |
| In-module | `./services/installDeps` |
| Submodule → parent | `../services/installDeps` (исключение, минимизировать) |

Запрещено: `@/modules/Install/services/installDeps`, `@/common` (barrel), `modules/foo.ts`.

## Вложенные уровни

Путь определяет логический уровень:

| Путь | Логический уровень |
|------|-------------------|
| `common/utilities/formatPath.ts` | common |
| `modules/Install/services/installDeps.ts` | modules |
| `modules/Install/modules/Lockfile/` | modules (submodule) |
| `commands/install.ts` | commands |
| `app/registry.ts` | app |

Module commands и private command modules в этом профиле **не используются**.

## Дерево решений: куда положить

```
Нужна глобальная доступность без import?
  → global (только .d.ts, polyfill, shim)

Привязано к бизнес-домену / CLI-фиче?
  → modules/<Name>/ (директория + index.ts)
    Слишком большой / нужна изоляция?
      → modules/<Name>/modules/<Sub>/
    Зависит от другого модуля?
      → soft IoC (интерфейс + app/init) или односторонний public API

Универсальная сущность в 1 файле, без business logic?
  → common/<category>/file.ts  (без index)

Bootstrap / config / registry команд / integrations?
  → app

Тонкий CLI-handler (argv → module → exit code)?
  → commands/<name>.ts
```

## Внутренняя структура модуля

FEOD не регламентирует внутренности — только public API. Типично для CLI:

```
ModuleName/
  types/
  services/
  lib/
  modules/        # подмодули
  index.ts
  README.md
```

## Soft IoC

- Предпочтительно: интерфейс зависимости в модуле, сборка в `app/init/` или `app/integrations/`.
- Допустимо: прямой импорт public API другого модуля при слабой односторонней связи.
- Недопустимо: deep import, zigzag, common → modules напрямую.

## Миграция текущего CLI на FEOD

1. Выделить `app/` — entry (`cli.ts` / `entry.ts`), `registry.ts`, config
2. Handlers команд → `commands/`
3. Доменную логику → `modules/<Feature>/` с `index.ts`
4. Общие утилиты → `common/` (без index)
5. Ambient types → `globals/`
6. Починить импорты по матрице (`@/`)
7. Синхронизировать `feod` в `packages/cli/package.json`

## Частые ошибки

| Ошибка | Правильно |
|--------|-----------|
| common = shared-слой | common = перевалочный пункт, без barrel |
| логика в commands | modules + тонкие commands |
| `modules/util.ts` | директория + index или common |
| deep import модуля | только `@/modules/Name` |
| pages / .vue / router | N/A — это CLI |

## Документация модуля

`README.md` в корне модуля:
- назначение
- public API
- пример использования

## Тестирование

- Unit-тесты модуля — внутри модуля / рядом с ним, изолированно
- Интеграция команд и registry — на уровне `app` или package tests
