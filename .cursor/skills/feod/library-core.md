# FEOD — library profile (`packages/core`)

> Отдельный профиль для `@bapm/core`. **Не** заменяет locked CLI-профиль в [SKILL.md](SKILL.md).

## Профиль (library)

| Параметр | Значение |
|----------|----------|
| scope | `packages/core` |
| modification | base (library) |
| multiapp | no |
| framework | none / library (TypeScript ESM) |
| srcRoot | `src` |
| alias | `@` → `src` |
| layerDirs | `app`, `pages`→**`pages`**, `modules`, `common`, `globals` |
| pages | empty stub (`.gitkeep`); no domain handlers |
| moduleCommands / private pages | N/A / unused |
| common.allowIndex | false |
| modules.allowDeepImports | false |
| singleFileModules | no |
| IoC | soft (optional; not required for pure library modules yet) |

`layerDirs.pages` = **`pages`** (не `commands`). В библиотеке нет CLI-команд.

## Структура

```
packages/core/src/
  app/
    publicApi.ts      # сборка named exports пакета из modules + константы
  modules/
    Manifest/
      index.ts        # public API
      …
      README.md
    Lockfile/
      index.ts
      …
      README.md
  common/
    yaml/
      loadDocument.ts # safe-subset YAML (без barrel)
      errors.ts       # нейтральный YamlError
    # NO index.ts
  pages/
    .gitkeep          # пустой stub
  globals/            # ambient / shim при необходимости
  index.ts            # thin façade → app/publicApi
```

## Отличия от CLI

| | CLI (`packages/cli`) | Library (`packages/core`) |
|--|----------------------|---------------------------|
| `pages` dir | `commands` (тонкие handlers) | `pages` stub (пустой) |
| entry | CLI bootstrap + registry | `app/publicApi` + thin `index.ts` |
| modules today | Help / Version / Install | Manifest / Lockfile |

## Правила (как у CLI, кроме pages)

- Cross-level импорты через `@/`
- Модули — только директории с `index.ts`; deep imports запрещены
- `common` без barrel; импорт конкретного файла
- Shared YAML в `common/yaml/`; Lockfile **не** deep-import'ит Manifest

См. также locked CLI skill: [SKILL.md](SKILL.md), [reference.md](reference.md).
