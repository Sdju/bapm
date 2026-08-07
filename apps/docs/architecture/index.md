# Architecture

Короткий обзор для **контрибьюторов** monorepo. Как пользоваться CLI в своём проекте: [Guide](/guide/), [Быстрый старт](/guide/quick-start) — не этот раздел.

## Пакеты

```
packages/core               @bapm/core                 domain: манифест, lockfile, resolver, install
packages/cli                bapm                       thin CLI поверх @bapm/core
packages/integration-api    bapm-integration-api       контракты capability между core и integrations
packages/integration-cursor bapm-integration-cursor    runtime-материализация (только Cursor)
packages/integration-claude bapm-integration-claude    Claude marketplace output
packages/integration-codex  bapm-integration-codex     Codex marketplace output
apps/docs                   @bapm/docs                 VitePress
```

Поведение хоста дают **integration-пакеты**. Runtime-материализация сегодня **только Cursor** и остаётся вне `@bapm/core`.

Claude и Codex — только marketplace-output, не runtime-адаптеры. Multi-target runtime — отдельный трек.

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
