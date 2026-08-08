# Contributing

Как пользоваться bapm в своём проекте — в [README](README.md) и [документации](apps/docs/guide/index.md). Ниже — работа над самим monorepo.

## Стек

- **TypeScript** (ESM)
- **vite-plus** (`vp`): tsdown / `vp pack`, oxlint, oxfmt, vitest, Vite Task
- **pnpm** workspaces + catalog
- **VitePress** — `apps/docs`
- **OpenSpec** — spec-driven workflow (`.cursor` + `openspec/`)

## Структура

```
apps/docs                    @bapm/docs                 VitePress
packages/core                @bapm/core                 домен: manifest, lockfile, resolver, install
packages/cli                 @bapm/cli                  CLI (bin: bapm)
packages/integration-api     @bapm/integration-api      контракты core ↔ integrations
packages/integration-cursor  @bapm/integration-cursor   runtime Cursor
packages/integration-claude  @bapm/integration-claude   marketplace-only Claude
packages/integration-codex   @bapm/integration-codex    marketplace-only Codex
openspec/                                               спецификации и изменения
.samples/                                               внешние референсы (gitignore)
```

Обзор пакетов: [architecture](apps/docs/architecture/index.md).

## Команды разработки

```bash
vp install          # зависимости
vp check            # format + lint + types
vp run -r test      # тесты
vp run -r build     # сборка пакетов
vp run docs#dev     # VitePress
pnpm run ready      # check + test + build
```

Сборка CLI из клона:

```bash
pnpm install
pnpm run -r build
node packages/cli/dist/cli.mjs --help
```

OpenSpec: `/opsx-propose`, `/opsx-apply`, `/opsx-archive`.

## Релизы

1. `pnpm run version:bump` — синхронно поднять `packages/*/package.json`
2. Закоммитить bump
3. `git tag vX.Y.Z && git push origin vX.Y.Z`

Тег `v*` запускает [`.github/workflows/release.yml`](.github/workflows/release.yml): проверка версий → CI → npm (OIDC trusted publishing) → GitHub Release. Документация на Pages: [`.github/workflows/docs.yml`](.github/workflows/docs.yml).

## Референс APM

Локальный клон (не в git):

```bash
git clone --depth 1 https://github.com/microsoft/apm.git .samples/apm
```
