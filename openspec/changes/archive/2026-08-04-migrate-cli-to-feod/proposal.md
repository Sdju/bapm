## Why

Пакет `packages/cli` уже объявил locked-профиль FEOD в `package.json`, но исходники остаются плоскими (`cli.ts` / `run.ts` / `index.ts`): нет слоёв `app` / `commands` / `modules` / `common` / `globals`, нет `@/*` alias и soft IoC. Без приведения кода к FEOD нельзя масштабировать CLI-команды и адаптеры над `@bapm/core` по правилам проекта.

## What Changes

- Реорганизовать `packages/cli/src` в FEOD-уровни: `app/`, `commands/`, `modules/`, `common/`, `globals/` (профиль locked, modification base).
- Вынести bootstrap, ручной registry команд и soft IoC в `app/` (`entry`/`cli`, `registry`, `init`, `integrations`).
- Сделать тонкие handlers в `commands/` для `help`, `version`, `install` (и флагов `-h`/`--help`, `-V`/`--version`).
- Перенести логику install-stub в CLI-модуль-адаптер `modules/` над `@bapm/core` через `app/integrations` (не прямой импорт core из commands).
- Добавить `paths` alias `@/*` → `src/*` в tsconfig (и при необходимости resolve в vite/vp pack).
- Сохранить публичный API пакета: экспорт `runCli`, entry `src/index.ts` + `src/cli.ts` (или re-export из app) для `vp pack` / `bin` — **без BREAKING** изменений контракта пакета.
- Не менять поведение команд: help / version / install-stub / unknown command остаются эквивалентными текущему `run.ts`.

### Non-goals

- Не трогать `apps/docs`, `@bapm/core` и другие пакеты.
- Не менять FEOD-профиль (нет Vue/SPA, multiapp, module commands, private commands, common index, single-file modules).
- Не реализовывать реальный `install` — только перенос stub в FEOD-структуру.
- Не добавлять ESLint feod-plugin в этом change.

## Capabilities

### New Capabilities

- `cli-feod-architecture`: структура и границы слоёв FEOD в `packages/cli` (уровни, alias, registry, modules public API, soft IoC, integrations к `@bapm/core`).
- `cli-runtime-surface`: сохранение публичного API (`runCli`, pack entries) и диспетчеризации команд help / version / install-stub / unknown.

### Modified Capabilities

- (нет — `openspec/specs/` пуст; существующих capability нет)

## Impact

- **Code:** только `packages/cli` (`src/`, `tsconfig.json`, при необходимости `vite.config.ts`); существующие unit-тесты обновятся под новые пути импорта при apply.
- **API:** публичный export `runCli` и bin/entry для pack сохраняются (совместимость).
- **Deps:** зависимость `@bapm/core` остаётся; доступ к core — через `app/integrations`, не из `commands/`.
- **Systems вне scope:** `apps/docs`, `@bapm/core` — без изменений.
