# bapm

**Better Agent Package Manager** — аналог [microsoft/apm](https://github.com/microsoft/apm) на TypeScript с явной архитектурой.

Менеджер зависимостей для конфигурации AI-агентов: манифест, lockfile, транзитивное разрешение. Материализация в хосты — отдельные пакеты таргетов (не in-tree адаптеры как у APM).

## Стек

- **TypeScript** (ESM)
- **vite-plus** (`vp`): tsdown/`vp pack`, oxlint, oxfmt, vitest, Vite Task
- **pnpm** workspaces + catalog
- **VitePress** — `apps/docs`
- **OpenSpec** — spec-driven workflow (`.cursor` + `openspec/`)

## Структура

```
apps/docs          @bapm/docs        документация (VitePress)
packages/core      @bapm/core        домен: manifest, lockfile, resolver, install
packages/cli       bapm              CLI поверх @bapm/core
# planned (не scaffold заранее):
#   bapm-target-api                  типы/утилиты; прослойка core ↔ targets
#   bapm-target-<id>                 eg bapm-target-cursor — materialize в хост
openspec/                            спецификации и изменения
.samples/                            внешние референсы (gitignore) — локальный клон microsoft/apm
```

Таргеты: см. `openspec/specs/target-package-architecture/` — без паритета с in-tree APM `adapters/client/`.

## Команды

```bash
vp install          # зависимости
vp check            # format + lint + types
vp run -r test      # тесты
vp run -r build     # сборка пакетов
vp run docs#dev     # VitePress
```

OpenSpec: `/opsx-propose`, `/opsx-apply`, `/opsx-archive`.

## Референс

В `.samples/apm` лежит локальный клон APM (не в git). Обновить:

```bash
git clone --depth 1 https://github.com/microsoft/apm.git .samples/apm
```
