## Why

`packages/core` уже содержит доменные области `manifest/` и `lockfile/`, но layout плоский: нет FEOD-слоёв, `@/*` alias и границ модулей. Lockfile deep-import'ит internals Manifest (`yaml-load`, `ManifestError`) — это ломает будущую модульность. После миграции CLI к FEOD ядро должно получить **отдельный library-профиль**, чтобы масштабировать resolver/install без смешения с CLI-правилами.

## What Changes

- Реорганизовать `packages/core/src` под **library locked FEOD**: слои `app/`, `modules/`, `common/`, `globals/` плюс пустой stub `pages/` (`.gitkeep`), **не** `commands/`.
- Выделить модули `Manifest` и `Lockfile` с public API только через `modules/<Name>/index.ts`.
- Вынести shared YAML safe-subset loader в `common/` (без barrel), чтобы Lockfile **не** deep-import'ил Manifest.
- Сделать `src/index.ts` тонким фасадом → `app/publicApi`; сохранить **все** текущие named exports `@b-apm/core` 1:1 (без **BREAKING**).
- Добавить `feod` block в `packages/core/package.json` и `@/*` → `src/*` в tsconfig (и alias в vite при необходимости).
- Зафиксировать capability `core-feod-architecture` (не расширять `cli-feod-architecture`).
- Документировать library-профиль core в design/tasks (или отдельный note рядом с FEOD skill) **без** изменения locked CLI-правил.

### Non-goals

- Не менять production-поведение M1/M2 (parse/discover/load/serialize/equivalence).
- Не трогать `packages/cli` код, если публичные exports core стабильны.
- Не расширять / не править `cli-feod-architecture` и не менять CLI locked FEOD skill rules.
- Не реализовывать resolver / install / primitives — только реорганизация существующего.
- Не добавлять ESLint feod-plugin в этом change.
- Не писать новые acceptance-тесты в plan/apply этого change (verify: существующие M1/M2 + unit остаются green).

## Capabilities

### New Capabilities

- `core-feod-architecture`: library FEOD layout и границы слоёв для `packages/core` (уровни app/modules/common/globals + empty pages, alias, modules public API, common без barrel, thin package export surface).

### Modified Capabilities

- (нет — поведение manifest/lockfile capabilities не меняется; только внутренняя структура core)

## Impact

- **Code:** только `packages/core` (`src/`, `tsconfig.json`, `vite.config.ts` при необходимости alias, `package.json` `feod` block); unit/acceptance импорты через `@b-apm/core` / `src/index.ts` должны продолжить работать.
- **API:** публичные named exports `@b-apm/core` — полный 1:1 parity (типы, функции, константы, `getVersion`, `BAPM_NAME`, `loadYamlDocument`).
- **Deps:** без новых runtime-зависимостей; `yaml` остаётся.
- **Docs/skills:** note о library-профиле core рядом с FEOD skill; CLI skill locked rules не ломаются.
- **Verify path:** после migrate — `packages/core` unit + M1/M2 acceptance green; CLI без правок, если exports стабильны.
- **Вне scope:** `packages/cli`, `apps/docs`, новые domain features.
