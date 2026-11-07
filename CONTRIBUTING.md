# Contributing

Как пользоваться bapm в своём проекте — в [README](README.md) и [документации](apps/docs/guide/index.md). Ниже — работа над самим monorepo.

## Стек

- **TypeScript** (ESM)
- **vite-plus** (`vp`): tsdown / `vp pack`, oxlint, oxfmt, vitest, Vite Task
- **pnpm** workspaces + catalog
- **VitePress** — `apps/docs`
- **OpenSpec** — spec-driven workflow (`.apm/` + `openspec/`)
- **bapm** — the repo manages its own agent skills, agents and commands with bapm

## Структура

```
apps/docs                    @b-apm/docs                 VitePress
packages/core                @b-apm/core                 домен: manifest, lockfile, resolver, install
packages/cli                 @b-apm/cli                  CLI (bin: bapm)
packages/integration-api     @b-apm/integration-api      контракты core ↔ integrations
packages/integration-cursor  @b-apm/integration-cursor   runtime Cursor
packages/integration-claude  @b-apm/integration-claude   marketplace-only Claude
packages/integration-codex   @b-apm/integration-codex    marketplace-only Codex
.apm/                                                   источник skills, agents и prompts
bapm.yml / bapm.lock.yaml                               манифест и lock конфигурации агентов
.agents/ .cursor/                                       генерируются bapm install (gitignore)
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
pnpm run agents:install  # разложить .apm/ в .agents/skills и .cursor/
pnpm run agents:check    # проверить развёрнутые файлы по lock
pnpm run ready      # check + test + build
```

Сборка CLI из клона:

```bash
pnpm install
pnpm run -r build
node packages/cli/dist/cli.mjs --help
```

OpenSpec: `/opsx-propose`, `/opsx-apply`, `/opsx-archive`.

## Конфигурация агентов

Репозиторий использует bapm для собственных skills, субагентов и команд. Источник истины — `.apm/`:

| Что       | Где                             |
| --------- | ------------------------------- |
| skills    | `.apm/skills/<name>/SKILL.md`   |
| субагенты | `.apm/agents/<name>.md`         |
| команды   | `.apm/prompts/<name>.prompt.md` |
| MCP       | `dependencies.mcp` в `bapm.yml` |

`bapm.yml` выбирает Cursor как агента по умолчанию. `bapm install` раскладывает примитивы в `.agents/skills/`, `.cursor/agents/` и `.cursor/commands/` и обновляет `bapm.lock.yaml`. В git коммитятся только `.apm/`, `bapm.yml` и `bapm.lock.yaml`; всё, что материализует bapm, перечислено в `.gitignore`. После клона агентские файлы нужно создать локально:

```bash
pnpm install
pnpm run -r build
pnpm run agents:install
```

Правьте `.apm/`, затем выполните (CLI должен быть собран — `dist/` не в git):

```bash
pnpm run -r build
pnpm run agents:install
pnpm run agents:check
```

Не редактируйте `.agents/skills/` и `.cursor/agents|commands/` вручную: следующий `bapm install` перезапишет файлы. Для skills из `.apm/skills/<name>/` и `skills/<name>/` bapm копирует в `.agents/skills/<name>/` весь каталог skill: `SKILL.md`, вспомогательные `.md`, скрипты и вложенные ассеты. Поэтому ссылки внутри `SKILL.md` можно писать относительно (`reference.md`, `branching.md`) — они работают и в `.apm/`, и в развёрнутой копии. Исключение — `SKILL.md` в корне пакета: там копируется только сам файл, иначе bapm разложил бы весь пакет.

Другой агент подключается без изменения общего `bapm.yml`:

```bash
pnpm add -Dw @b-apm/integration-claude
```

```yaml
# bapm.local.yml (не в git)
active:
  target: claude
```

MCP-серверы и другие артефакты описываются в `bapm.yml`; bapm сам пишет конфиги выбранного агента (например, `.cursor/mcp.json`), и они не коммитятся.

CI выполняет `bapm install --no-frozen` и `bapm audit --ci`: развёрнутые файлы в git отсутствуют, поэтому frozen-режим на чистом checkout не подходит. Отдельный CI-шаг проверяет, что сгенерированные артефакты не попали в индекс.

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
