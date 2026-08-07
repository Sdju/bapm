# bapm

**Better Agent Package Manager** — аналог [microsoft/apm](https://github.com/microsoft/apm) на TypeScript с явной архитектурой.

Менеджер зависимостей для конфигурации AI-агентов: манифест, lockfile, транзитивное разрешение. Материализация в хосты — отдельные integration-пакеты (не in-tree адаптеры как у APM).

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
packages/integration-api     bapm-integration-api     контракты/registry; прослойка core ↔ integrations
packages/integration-cursor  bapm-integration-cursor  runtime Cursor
packages/integration-claude  bapm-integration-claude  marketplace-only Claude output
packages/integration-codex   bapm-integration-codex   marketplace-only Codex output
openspec/                            спецификации и изменения
.samples/                            внешние референсы (gitignore) — локальный клон microsoft/apm
```

Integrations: см. `openspec/specs/integration-package-architecture/` — без паритета с in-tree APM `adapters/client/`.

## Conformance & parity

bapm целится в **OpenAPM v0.1** wire (форматы и семантика), а не в полный product surface microsoft/apm. Это **not a drop-in** замена всей **APM CLI** / каждого адаптера.

- Statement: [`CONFORMANCE.md`](CONFORMANCE.md) (+ [`CONFORMANCE.json`](CONFORMANCE.json))
- Claimed classes: **Consumer**, **Producer**, **Governance**; **Registry N/A** (host не ship'им)
- Intentional diffs vs APM: **∩-pick** (не APM **first-wins**), **cursor-only** deploy matrix, **dual-read** branding (`apm.yml`\|`bapm.yml`), bapm-only **`local`** source (vs OpenAPM `path:`)

Подробности и Limitations — в CONFORMANCE; на сайте docs — [Conformance & boundary](apps/docs/guide/conformance.md).

## Portable Agent Plugins v1

Поддержка переносимых Agent Plugins v1 ограничена `plugin.json`, непосредственными
`skills/<name>/SKILL.md` и корневым `mcp.json`; Cursor адаптирует поддерживаемые MCP
транспорты в свой формат. Это не claim универсальной совместимости, не OpenAPM claim
и не marketplace-публикация. Проверяемая матрица и non-goals: [AGENT_PLUGINS_COMPATIBILITY.md](AGENT_PLUGINS_COMPATIBILITY.md).

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
