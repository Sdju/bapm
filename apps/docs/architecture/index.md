# Architecture

Короткий обзор для **контрибьюторов** monorepo. Как пользоваться CLI в своём проекте: [Guide](/guide/), [Быстрый старт](/guide/quick-start) — не этот раздел.

## Пакеты

```
packages/core                  @b-apm/core                    domain: манифест, lockfile, resolver, install
packages/cli                   @b-apm/cli                     thin CLI поверх @b-apm/core (bin: bapm)
packages/integration-api       @b-apm/integration-api          контракты capability между core и integrations
packages/integration-cursor    @b-apm/integration-cursor       Cursor runtime (opt-in package)
packages/integration-opencode  @b-apm/integration-opencode     OpenCode runtime (opt-in package)
packages/integration-claude    @b-apm/integration-claude       Claude runtime + marketplace output
packages/integration-codex     @b-apm/integration-codex        Codex runtime + marketplace output
packages/integration-copilot   @b-apm/integration-copilot      GitHub Copilot runtime (opt-in package)
packages/integration-windsurf  @b-apm/integration-windsurf     Windsurf runtime (opt-in package)
apps/docs                      @b-apm/docs                    VitePress
```

Поведение хоста дают **integration-пакеты** (`@b-apm/integration-*` / `@b-apm/integration-api`). Cursor, OpenCode, Claude, Codex, Copilot и Windsurf — **opt-in** runtime: ставятся отдельно; известный host CLI загружает из canonical-пакета `@b-apm/integration-<id>`, а выбор делает через detect, `active` или `--target`. Object-map `target` / `targets` нужен для override или custom host и **динамически загружает** npm-пакеты либо локальные пути до selection на `install` / `compile` (Claude: skills под `.claude/skills/`, rules/agents/commands/hooks под `.claude/`, MCP в `.mcp.json`, compile → `CLAUDE.md`; Codex: skills под `.agents/skills/`, agents/hooks/MCP под `.codex/`, compile → `AGENTS.md` включая instructions; Copilot: instructions/prompts/agents/hooks под `.github/`, skills под `.agents/skills/`, MCP home translate `~/.copilot/mcp-config.json`, compile → `.github/copilot-instructions.md`; Windsurf: rules/workflows/hooks под `.windsurf/`, skills под `.agents/skills/`, agents skip, MCP home bake `~/.codeium/windsurf/mcp_config.json`). CLI composition root **не** регистрирует hosts eagerly. Claude и Codex также предоставляют marketplace-output при `bapm pack` (on-demand). Cursor и Codex делят `AGENTS.md` (last-writer-wins). Встроенная multi-target runtime matrix в одном прогоне — отдельный трек; кастомные integrations через map — да.

Пользовательский how-to (примеры YAML, контракт `createIntegration`): [Поддерживаемые hosts](/guide/supported-hosts). Контракт пакета: `@b-apm/integration-api` README; reference: `@b-apm/integration-cursor` / `@b-apm/integration-opencode` / `@b-apm/integration-claude` / `@b-apm/integration-codex` / `@b-apm/integration-copilot` / `@b-apm/integration-windsurf`.

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
