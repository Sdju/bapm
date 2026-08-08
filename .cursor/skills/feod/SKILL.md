---
name: feod
description: >-
  FEOD для packages/cli (профиль locked через feod-init). Уровни
  app/commands/modules/common/global, public API модулей, фрактальные подмодули,
  soft IoC. Используй при структуре CLI, добавлении модулей и команд, feod.config,
  или когда упоминают FEOD / Fractal Entity Oriented Design в этом проекте.
  Правила закреплены — не предлагай другие модификации без явной смены профиля.
---

# FEOD — правила проекта (CLI)

> **Locked.** Профиль задан для `@bapm` CLI (`packages/cli`). Не предлагай Vue/SPA,
> pages, multiapp, commonless и прочие вариации. Смена профиля — только по явной просьбе.

## Профиль проекта (locked)

| Параметр                 | Значение                                          |
| ------------------------ | ------------------------------------------------- |
| scope                    | `packages/cli` (`apps/docs` вне FEOD)             |
| modification             | base                                              |
| multiapp                 | no                                                |
| framework                | none / CLI (TypeScript)                           |
| srcRoot                  | `src`                                             |
| alias                    | `@` → `src`                                       |
| layerDirs                | `app`, `commands`, `modules`, `common`, `globals` |
| commands                 | верхний `commands/` обязателен                    |
| moduleCommands           | no                                                |
| commandRegistry          | manual в `app`                                    |
| privateCommands          | forbid                                            |
| common.allowIndex        | false (index в common запрещён полностью)         |
| modules.allowDeepImports | false                                             |
| singleFileModules        | no (запрещены)                                    |
| transit                  | none                                              |
| IoC                      | soft                                              |
| DDD in modules           | no                                                |
| ESLint feod-plugin       | no                                                |

## Суть

FEOD сочетает **модульный** и **слоистый** подходы: центр — **modules**; уровни (app/commands/common/global) — инструменты для модульности, а не слои абстракции как в FSD.

Три столпа: **модульность**, **фрактальность** (подмодули в `modules/<Name>/modules/`), **сущность-ориентированность** (роль файла/папки).

FEOD ≠ FSD. `common` ≠ `shared` из FSD: common — перевалочный пункт для сущностей, ещё не ставших модулем. Сущности нормально **переезжают** между уровнями.

## Уровни и импорты

```
common → modules → commands → app
global — нигде не импортируется в коде (доступ без import; .d.ts через tsconfig)
```

| Уровень      | Назначение                                       | Импортирует                         | Кем импортируется                      |
| ------------ | ------------------------------------------------ | ----------------------------------- | -------------------------------------- |
| **global**   | shim, полифиллы, `.d.ts`                         | —                                   | никем (редкий init в app — исключение) |
| **common**   | мелкие переиспользуемые сущности, обычно 1 файл  | common                              | modules, commands, app                 |
| **modules**  | доменная/CLI-логика, изолированные модули        | common, modules (только `index.ts`) | modules, commands, app                 |
| **commands** | CLI-команда → тонкий handler                     | common, modules                     | только app                             |
| **app**      | bootstrap, registry команд, config, integrations | common, modules, commands           | никем                                  |

**Жёсткие правила:**

- `index.ts` / barrel — **только** публичный API модуля (`modules/<Name>/index.ts`).
- В `common` **запрещён любой** `index.ts` / barrel — импорт конкретного файла: `@/common/utilities/formatDate`.
- Межмодульные импорты — **только** через `@/modules/<Name>` → `index.ts`. Deep imports запрещены.
- Однофайловые модули (`modules/foo.ts`) запрещены — только директория с `index.ts`.
- Cross-level импорты — через alias `@/` (не `../../`).
- In-level / in-module — относительные пути допустимы.
- Подмодули: из подмодуля можно импортировать родителя (исключение, избегать); снаружи — только public API. Не глубже ~3 уровней вложенности.
- Zigzag-импорты между модулями — запрещены.
- `common` → modules — только через **IoC** (интерфейс + внедрение из app), не прямым импортом.
- Module commands (`modules/<Name>/commands/`) — **не использовать**.
- Private command-модули (`commands/_name/`) — **запрещены**.

## Структура (`packages/cli/src`)

```
src/
  app/
    entry.ts           # или cli.ts — точка входа процесса
    registry.ts        # ручная регистрация команд
    config/
    integrations/      # внешние сервисы, адаптеры к @bapm/core и т.п.
    init/              # soft IoC: сборка зависимостей
  commands/
    help.ts
    version.ts
    install.ts         # тонкий handler: parse args → вызвать module API
  modules/
    FeatureName/
      services/        # или api/, lib/ — по домену
      types/
      modules/         # подмодули (фрактал)
      index.ts         # public API
      README.md
  common/
    utilities/
    types/
    constants/
    # нет index.ts
  globals/
    node.d.ts          # при необходимости
```

## feod.config

В `packages/cli/package.json`:

```json
{
  "feod": {
    "srcRoot": "src",
    "aliasPrefix": "@",
    "layerDirs": {
      "app": "app",
      "pages": "commands",
      "modules": "modules",
      "common": "common",
      "global": "globals"
    },
    "common": { "allowIndex": false },
    "modules": {
      "publicEntry": "index.ts",
      "allowDeepImports": false,
      "singleFileModules": false
    },
    "pages": {
      "useFileBasedRouting": false,
      "modulePages": false,
      "privateModulesPrefix": null
    }
  }
}
```

`layerDirs.pages` = `commands`: роль «тонкий entry слоя» сохраняется, имя папки — `commands`.

### Alias (tsconfig)

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

## Workflow: добавить модуль

1. Создать `src/modules/<PascalCase>/` (директория, не одиночный файл).
2. Экспортировать **только нужное** из `index.ts`.
3. Внутренние файлы снаружи не импортировать.
4. При росте — `modules/<Name>/modules/<Sub>/`.
5. Кросс-модульные зависимости — soft IoC: опциональная зависимость в API модуля, сборка в `app/init/` или `app/integrations/`.
6. Документировать: `README.md` (назначение, public API, пример).

### Шаблон index.ts

```ts
export { installDeps } from "./services/installDeps";
export type { InstallOptions, InstallResult } from "./types/install.types";
```

### Soft IoC

```ts
// modules/Install/index.ts
export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export function createInstall(deps?: { logger?: Logger }) {
  const log = deps?.logger ?? { info: console.log, error: console.error };
  return {
    async run(options: InstallOptions): Promise<InstallResult> {
      log.info("install…");
      // …
    },
  };
}

// app/init/install.ts — внедрение из app при необходимости
import { createInstall } from "@/modules/Install";
import { cliLogger } from "../integrations/logger";

export const install = createInstall({ logger: cliLogger });
```

Жёсткая связанность без IoC допустима слабо (soft): предпочитай IoC, но не блокируй простой импорт public API другого модуля, если зависимость односторонняя и стабильная.

## Workflow: добавить команду

1. Создать тонкий handler в `src/commands/<name>.ts`.
2. Handler: разбор argv/флагов → вызов `@/modules/<Name>` → код выхода. Без доменной логики.
3. Зарегистрировать вручную в `app/registry.ts` (или аналоге).
4. Имена команд — при необходимости `common/constants/commands.ts`.

### Шаблон команды

```ts
// commands/install.ts
import { createInstall } from "@/modules/Install";

export async function installCommand(argv: string[]): Promise<number> {
  const install = createInstall();
  const result = await install.run({ args: argv });
  return result.ok ? 0 : 1;
}
```

## Куда положить сущность

| Сущность                                           | Уровень      |
| -------------------------------------------------- | ------------ |
| Точка входа, registry команд, config, integrations | **app**      |
| CLI-команда (тонкий handler)                       | **commands** |
| Доменная логика, сервисы, работа с манифестом/lock | **modules**  |
| `formatPath`, константы, мелкий тип без домена     | **common**   |
| Ambient types, shim Node                           | **global**   |

Подробнее — [reference.md](reference.md).

## Антипаттерны

- ❌ Импорт внутренностей модуля (`@/modules/Install/services/x`) — только `@/modules/Install`
- ❌ Любой `common/index.ts` или barrel в common
- ❌ Однофайловый модуль `modules/foo.ts`
- ❌ Бизнес-логика в `commands/` или `app/`
- ❌ `modules/<Name>/commands/` (module commands выключены)
- ❌ `commands/_name/` (private command modules запрещены)
- ❌ Модуль «ради одной утилиты» — положить в common или подмодуль
- ❌ >3 уровней вложенности подмодулей без обоснования
- ❌ Путать common FEOD со shared FSD

## Чеклист перед завершением

- [ ] Импорты соблюдают матрицу уровней
- [ ] Модули — директории с `index.ts`; deep imports нет
- [ ] Commands тонкие; логика в modules
- [ ] Common без index/barrel
- [ ] Global только для shim/polyfill/ambient types
- [ ] App без бизнес-логики; registry команд ручной
- [ ] feod.config в `packages/cli/package.json` актуален

## Дополнительно

- Матрица импортов и дерево решений — [reference.md](reference.md)
- Шаблоны scaffold — [examples.md](examples.md)
- Library-профиль `@bapm/core` — [library-core.md](library-core.md) (отдельно от CLI locked)
