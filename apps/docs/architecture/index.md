# Architecture

Короткий обзор для **контрибьюторов** monorepo. Как пользоваться CLI в своём проекте: [Guide](/guide/), [Быстрый старт](/guide/quick-start) — не этот раздел.

## Пакеты

```
packages/core               @bapm/core                 domain: манифест, lockfile, resolver, install
packages/cli                @bapm/cli                  thin CLI поверх @bapm/core (bin: bapm)
packages/integration-api    @bapm/integration-api       контракты capability между core и integrations
packages/integration-cursor @bapm/integration-cursor    runtime-материализация (только Cursor)
packages/integration-claude @bapm/integration-claude    Claude marketplace output
packages/integration-codex  @bapm/integration-codex     Codex marketplace output
apps/docs                   @bapm/docs                 VitePress
```

Поведение хоста дают **integration-пакеты**. Built-in runtime — **Cursor** (`@bapm/integration-cursor`), регистрируется CLI composition root. Object-map `target` / `targets` в манифесте дополнительно **динамически загружает** указанные npm-пакеты (resolve из project cwd) и регистрирует их до selection на `install` / `compile`. Claude и Codex — только marketplace-output, не runtime-адаптеры (невалидны как значения map для install/compile). Multi-target runtime materialize в одном прогоне — отдельный трек.

### Author how-to: custom runtime integration

1. Publish an npm package that exports a runtime `BapmIntegration` (prefer named `createIntegration()`; default-export object/factory also accepted). Contract: `@bapm/integration-api` README; reference implementation: `@bapm/integration-cursor`.
2. Add the package as a normal project dependency (`pnpm add @acme/my-integration`).
3. Declare the object-map in `bapm.yml` / `apm.yml`:

```yaml
targets:
  x-acme-editor: "@acme/my-integration"
```

4. Run `bapm install --target x-acme-editor` (or `bapm compile --target x-acme-editor`). Selection rules are unchanged: `--target` → detect → fail.

Claude/Codex packages remain marketplace-output only unless a future runtime package exists.

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
