# Architecture

Короткий обзор для **контрибьюторов** monorepo. Как пользоваться CLI в своём проекте: [Guide](/guide/), [Быстрый старт](/guide/quick-start) — не этот раздел.

## Пакеты

```
packages/core                  @bapm/core                    domain: манифест, lockfile, resolver, install
packages/cli                   @bapm/cli                     thin CLI поверх @bapm/core (bin: bapm)
packages/integration-api       @bapm/integration-api          контракты capability между core и integrations
packages/integration-cursor    @bapm/integration-cursor       Cursor runtime (opt-in package)
packages/integration-opencode  @bapm/integration-opencode     OpenCode runtime (opt-in package)
packages/integration-claude    @bapm/integration-claude       Claude marketplace output
packages/integration-codex     @bapm/integration-codex        Codex marketplace output
apps/docs                      @bapm/docs                    VitePress
```

Поведение хоста дают **integration-пакеты** (`@bapm/integration-*` / `@bapm/integration-api`). Cursor (`@bapm/integration-cursor`) и OpenCode (`@bapm/integration-opencode`) — **opt-in**: ставятся отдельно и объявляются в object-map `targets:` (skills/agents под `.opencode/`, MCP в `opencode.json`); CLI composition root **не** регистрирует hosts eagerly. Object-map `target` / `targets` **динамически загружает** npm-пакеты или локальные пути и регистрирует их до selection на `install` / `compile`. Claude и Codex — marketplace-output (тоже on-demand при `bapm pack`), не runtime-адаптеры map. Встроенная multi-target runtime matrix в одном прогоне — отдельный трек; кастомные integrations через map — да.

Пользовательский how-to (примеры YAML, контракт `createIntegration`): [Поддерживаемые hosts](/guide/supported-hosts). Контракт пакета: `@bapm/integration-api` README; reference: `@bapm/integration-cursor` / `@bapm/integration-opencode`.

Граница OpenAPM claim vs APM product CLI: [Совместимость](/guide/conformance).

## Сборка CLI из исходников

Для разработки в клоне репозитория (не для пользователей продукта):

```bash
# в корне monorepo
pnpm install
pnpm run -r build
node packages/cli/dist/cli.mjs --help
```

Референс-реализация (Python): `.samples/apm` → [microsoft/apm](https://github.com/microsoft/apm) (локально, вне git).
