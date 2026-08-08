# Architecture

Короткий обзор для **контрибьюторов** monorepo. Как пользоваться CLI в своём проекте: [Guide](/guide/), [Быстрый старт](/guide/quick-start) — не этот раздел.

## Пакеты

```
packages/core                  @bapm/core                    domain: манифест, lockfile, resolver, install
packages/cli                   @bapm/cli                     thin CLI поверх @bapm/core (bin: bapm)
packages/integration-api       @bapm/integration-api          контракты capability между core и integrations
packages/integration-cursor    @bapm/integration-cursor       Cursor runtime (opt-in package)
packages/integration-opencode  @bapm/integration-opencode     OpenCode runtime (opt-in package)
packages/integration-claude    @bapm/integration-claude       Claude runtime + marketplace output
packages/integration-codex     @bapm/integration-codex        Codex runtime + marketplace output
packages/integration-copilot   @bapm/integration-copilot      GitHub Copilot runtime (opt-in package)
packages/integration-agent-skills @bapm/integration-agent-skills  agent-skills runtime (skills-only, explicit-only)
apps/docs                      @bapm/docs                    VitePress
```

Поведение хоста дают **integration-пакеты** (`@bapm/integration-*` / `@bapm/integration-api`). Cursor, OpenCode, Claude, Codex, Copilot и agent-skills — **opt-in** runtime: ставятся отдельно и объявляются в object-map `targets:` (Claude: skills под `.claude/skills/`, rules/agents/commands/hooks под `.claude/`, MCP в `.mcp.json`, compile → `CLAUDE.md`; Codex: skills под `.agents/skills/`, agents/hooks/MCP под `.codex/`, compile → `AGENTS.md` включая instructions; Copilot: instructions/prompts/agents/hooks под `.github/`, skills под `.agents/skills/`, MCP home translate `~/.copilot/mcp-config.json`, compile → `.github/copilot-instructions.md`; agent-skills: skills-only под `.agents/skills/`, never auto-detect); CLI composition root **не** регистрирует hosts eagerly. Object-map `target` / `targets` **динамически загружает** npm-пакеты или локальные пути и регистрирует их до selection на `install` / `compile`. Claude и Codex также предоставляют marketplace-output при `bapm pack` (on-demand). Cursor и Codex делят `AGENTS.md` (last-writer-wins). Встроенная multi-target runtime matrix в одном прогоне — отдельный трек; кастомные integrations через map — да.

Пользовательский how-to (примеры YAML, контракт `createIntegration`): [Поддерживаемые hosts](/guide/supported-hosts). Контракт пакета: `@bapm/integration-api` README; reference: `@bapm/integration-cursor` / `@bapm/integration-opencode` / `@bapm/integration-claude` / `@bapm/integration-codex` / `@bapm/integration-copilot` / `@bapm/integration-agent-skills`.

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
