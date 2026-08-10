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
apps/docs                    @b-apm/docs                 VitePress
packages/core                @b-apm/core                 домен: manifest, lockfile, resolver, install
packages/cli                 @b-apm/cli                  CLI (bin: bapm)
packages/integration-api     @b-apm/integration-api      контракты core ↔ integrations
packages/integration-cursor  @b-apm/integration-cursor   runtime Cursor
packages/integration-claude  @b-apm/integration-claude   marketplace-only Claude
packages/integration-codex   @b-apm/integration-codex    marketplace-only Codex
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

Lockstep: все `packages/*` одной версии. Первый публичный npm-релиз — **`0.1.0`** (все 14 пакетов сразу).

### Перед первым publish (разово)

1. Создать npm org **`b-apm`** (scope `@b-apm`) — уже зарегистрирован; убедиться, что аккаунт owner/publish.
2. На [npmjs.com](https://www.npmjs.com/) для org `b-apm` настроить **Trusted Publishing (OIDC)** на GitHub repo `Sdju/bapm`, workflow filename ровно **`release.yml`** (без `NPM_TOKEN`). Первичный publish (bootstrap) — вручную с 2FA/OTP или granular token; дальше — тег `v*`.
3. Синхронизировать publish-метаданные: `pnpm run publish:meta` (repository / engines / LICENSE / `prepublishOnly`).
4. Убедиться, что `packages/*/package.json` на целевой версии (первый публичный релиз: **0.1.0**).

### Обычный релиз

1. `pnpm run publish:meta` — если добавляли пакет или меняли org/repo URL
2. `pnpm run version:bump` — синхронно поднять `packages/*/package.json` (или `bumpp … --release X.Y.Z`)
3. Закоммитить bump (+ meta), смёржить в default branch при необходимости
4. `git tag vX.Y.Z && git push origin vX.Y.Z`

Тег `v*` запускает [`.github/workflows/release.yml`](.github/workflows/release.yml): сверка версий с тегом → check/test/build → `pnpm publish` (OIDC) → GitHub Release с tarball’ами.

Первый publish (**0.1.0**) выполнен: в README / `apps/docs` держите предупреждения **UNSTABLE** (пакеты на npm под `@b-apm`, но не для production) — не формулировки «пакеты не на npm». Дальнейшие релизы через OIDC — тег `v*`.

Документация на Pages: [`.github/workflows/docs.yml`](.github/workflows/docs.yml).

### Локальная проверка без publish

```bash
pnpm run publish:meta
pnpm run -r build
pnpm -r --filter './packages/**' exec pnpm pack
# или dry-run (нужен npm login / не обязателен для pack):
# pnpm -r --filter './packages/**' publish --dry-run --no-git-checks --access public
```

## Референс APM

Локальный клон (не в git):

```bash
git clone --depth 1 https://github.com/microsoft/apm.git .samples/apm
```
