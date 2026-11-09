# Общие паттерны интеграций → `@b-apm/integration-api`

**Дата:** 09.11.2026  
**Репозиторий:** `bapm`, ветка `master`, HEAD `14a1b6e`  
**Объект:** 13 пакетов `packages/integration-*` и публичный слой `packages/integration-api`  
**Метод:** read-only разбор `create*Integration.ts`, тестов и спецификаций (`integration-api-contracts`, `integration-*-runtime`), без изменения кода.

## Статус реализации (09.11.2026)

| Волна | Пункты                                                                    | Статус                                                       |
| ----- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P0    | deploy-root guard, compile, env-ссылки, JSON/JSONC IO                     | **готово**                                                   |
| P1    | materialize-session, MCP merge, frontmatter, hook source/event, home-пути | **готово**                                                   |
| P2    | skills-only, LSP merge, naming/capabilities/detect                        | **готово**                                                   |
| P2.10 | полный `mergeHookDeployment`                                              | **готово** — 5 event-map хостов переведены на общий pipeline |

Проверки: `vp check` — 0 ошибок, все тесты `integration-api` (19 файлов / 115 тестов) и всех `integration-*` зелёные; core 1 600, cli 829. В 16 существующих host-файлах диффстат: **−1297 строк** (2034 удаления / 737 добавлений), плюс новые модули API.

### Правки по ревью

- Codex снова fail-closed для невалидных env-ссылок (`${TOKEN-WITH-DASH}` не пишется статическим заголовком).
- `readHookSource` возвращает диагностику на JSON `null`, а не падает.
- `resolveXdgConfigHome` использует `isAbsolute` и поддерживает `allowRelative` для OpenCode.
- `parseFrontmatter` сохраняет ведущие комментарии как `prelude`.
- `mergeMcpServers` заменяет array-значения при shallow merge.

## Краткий вывод

`@b-apm/integration-api` уже закрывает нижний слой: `primitivesMaterialize`, `materializeSkill`, `writeDeployedFile`, `renderPrimitivesMarkdown`, `compileMarkdownReport`, `filterFrontmatterKeys`, hook-sidecar helpers и `pruneManagedMcpServerNames`.

Основное дублирование осталось на «среднем слое»:

1. проверка deploy roots;
2. compile-обвязка;
3. чтение/запись JSON-конфигов;
4. нормализация и слияние MCP-серверов;
5. трансляция env-ссылок;
6. frontmatter-трансформации;
7. hook source/event/script pipeline;
8. home-scope пути.

Это не требует нового каталога хостов. Наоборот: в API стоит вынести только host-neutral механику, а карты назначений, форматы и транспортные особенности оставить интеграциям.

## Карта покрытия

| Интеграция   | Deploy roots                | detect                          | compile              | MCP                                   | Hooks                   | LSP | Scope / особенности           |
| ------------ | --------------------------- | ------------------------------- | -------------------- | ------------------------------------- | ----------------------- | --- | ----------------------------- |
| agent-skills | `.agents`                   | false                           | —                    | —                                     | —                       | —   | global files, skills-only     |
| antigravity  | `.agents`, `.`              | false                           | `AGENTS.md` (omit)   | `.agents/mcp_config.json`             | `.agents/hooks.json`    | —   | container `bapm`              |
| claude       | `.claude`, `.`              | `.claude`, `CLAUDE.md`          | `CLAUDE.md` (omit)   | `.mcp.json`                           | `.claude/settings.json` | да  | global files/compile          |
| codex        | `.codex`, `.agents`, `.`    | `.codex`                        | `AGENTS.md`          | `.codex/config.toml`                  | `.codex/hooks.json`     | —   | global files/compile          |
| copilot      | `.github`, `.agents`        | `.github/*`                     | copilot-instructions | `~/.copilot/mcp-config.json`          | `.github/hooks/*`       | да  | home MCP, hooks per primitive |
| cursor       | `.agents/skills`, `.cursor` | `.cursor`                       | `AGENTS.md`          | `.cursor/mcp.json`                    | `.cursor/hooks.json`    | —   | global MCP/files/compile      |
| gemini       | `.gemini`, `.agents`, `.`   | `.gemini`, `GEMINI.md`          | `GEMINI.md` (only)   | `.gemini/settings.json`               | `.gemini/settings.json` | —   | commands → TOML               |
| grok-bot     | `agent-data`                | false                           | —                    | —                                     | —                       | —   | skills-only                   |
| grok-build   | `.grok`, `.`                | `.grok`                         | `AGENTS.md`          | —                                     | skip                    | —   | no MCP                        |
| hermes       | `.agents`                   | false                           | `AGENTS.md`          | `$HERMES_HOME/config.yaml`            | —                       | —   | home MCP, skills-only         |
| intellij     | —                           | false                           | —                    | `$XDG_CONFIG_HOME/.../mcp.json`       | —                       | —   | MCP-only                      |
| kiro         | `.kiro`, `.`                | `.kiro`                         | `AGENTS.md` (omit)   | `.kiro/settings/mcp.json`             | `.kiro/hooks/*.json`    | —   | hooks per event, steering     |
| opencode     | `.opencode`, `.`            | `.opencode`, `opencode.json(c)` | `AGENTS.md`          | `opencode.json`                       | skip                    | —   | global MCP                    |
| windsurf     | `.windsurf`, `.agents`      | `.windsurf`                     | —                    | `~/.codeium/windsurf/mcp_config.json` | `.windsurf/hooks.json`  | —   | home MCP                      |

> Всего: 13 интеграций (в таблице 14 строк: `agent-skills` и `antigravity` используют общий `.agents`), 11 `configureMcp`, 10 `compile`, 8 hook-pipeline, 2 LSP.

## Каталог паттернов

### P0 — механические, низкий риск

#### P0.1. Deploy-root guard

**Где:** `integration-cursor/src/createCursorIntegration.ts:93`, `integration-hermes/src/createHermesIntegration.ts:84`, `integration-grok-bot/src/createGrokBotIntegration.ts:36` и ещё 8 файлов (всего 11; 15 вхождений `roots.some`).

**Что повторяется:**

```ts
roots.some((r) => r === ".agents" || r.startsWith(".agents"));
roots.some((r) => r === ".agents" || r.startsWith(".agents/"));
roots.some((r) => r === "agent-data" || r.startsWith("agent-data/"));
```

Разные хвосты слэшей уже создают риск ложного отрицания.

**Предложение:**

```ts
export function hasDeployRoot(deployRoots: readonly string[], root: string): boolean;
export function requireDeployRoots(
  deployRoots: readonly string[],
  required: readonly string[],
  label: string,
): void;
```

Нормализовать `./`, trailing `/` и сравнивать посегментно. Текст ошибки сохранить в текущем формате: `<label> target missing <root> deploy root`.

**Эффект:** минус копипаста, единая семантика containment, невозможность расхождения `.agents` / `.agents/`.

---

#### P0.2. Compile-обвязка

**Где:** 10 файлов: `integration-claude:86`, `integration-codex:73`, `integration-cursor:75`, `integration-copilot:73`, `integration-gemini:66`, `integration-kiro:98`, `integration-antigravity:59`, `integration-opencode:67`, `integration-hermes:67`, `integration-grok-build:44`.

**Что повторяется:** `renderPrimitivesMarkdown` + `compileMarkdownReport`; отличаются только title, output file, `requireBasename` и фильтр инструкций.

**Предложение:**

```ts
export type InstructionCompileMode = "include" | "omit" | "only";

export function compilePrimitivesMarkdown(
  primitives: AttributedPrimitiveSet,
  context: CompileContext,
  options: {
    title: string;
    defaultOutput: string;
    instructions?: InstructionCompileMode; // default "include"
    requireBasename?: string;
    emptyMessage?: string;
    sectionHeading?: (p: AttributedPrimitive) => string;
    outsideCwdMessage?: string;
  },
): CompileReport;
```

Семантика `instructions`:

- `include` — без фильтра;
- `omit` — исключать `/instruction/i`, но рендерить при `context.includeInstructions === true`;
- `only` — оставлять только инструкции.

**Эффект:** ~140 строк долой, Build ID и проверка выхода за `cwd` остаются в одном месте.

---

#### P0.3. Env-ссылки MCP

**Где:** `integration-cursor:349`, `integration-opencode:331`, `integration-copilot:402`, `integration-kiro:309`, `integration-intellij:252`; извлечение одиночной ссылки — `integration-codex:556`.

**Что повторяется:** четыре диалекта и разные выходные формы:

| Хост     | Вход                                 | Выход      |
| -------- | ------------------------------------ | ---------- |
| Cursor   | `${env:V}`, `${V}`, `{env:V}`, `<V>` | `${env:V}` |
| OpenCode | `${env:V}`, `${V}`, `{env:V}`, `<V>` | `{env:V}`  |
| Copilot  | `${env:V}`, `<V>`                    | `${V}`     |
| Kiro     | `${env:V}`, `<V>`                    | `${V}`     |
| IntelliJ | `${env:V}`, `${V}`, `<V>`            | `${env:V}` |

**Предложение:**

```ts
export type EnvReferenceStyle = "dollar-env" | "brace-env" | "dollar-bare";

export function translateEnvReferences(value: string, style: EnvReferenceStyle): string;
export function translateEnvMap(
  values: Record<string, string>,
  style: EnvReferenceStyle,
): Record<string, string>;
export function hasEnvReference(value: string): boolean;
export function extractEnvReference(value: string): string | undefined;
```

`hasEnvReference` / `extractEnvReference` закрывают Codex header-mapping (`http_headers` / `env_http_headers` / `bearer_token_env_var`).

**Эффект:** один аудит security-sensitive логики; невозможно случайно записать литеральный секрет в конфиг.

---

#### P0.4. JSON/JSONC config IO

**Где:** `readExistingMcpDoc` в Cursor/Claude/Copilot/Kiro/Windsurf, `readExistingJsonDoc` в Antigravity/OpenCode, `readIntellijConfig` + `stripJsonc`.

**Что повторяется:** чтение объекта, tolerant/strict поведение, запись `JSON.stringify(doc, null, 2) + "\n"`.

**Предложение:**

```ts
export type ReadJsonDocumentOptions = {
  path: string;
  label?: string;
  strict?: boolean; // default false
  jsonc?: boolean; // default false
};

export function readJsonDocument(options: ReadJsonDocumentOptions): Record<string, unknown>;
export function writeJsonDocument(path: string, doc: unknown): void;
export function stripJsonc(raw: string): string;
```

Сохранить разницу:

- tolerant (`{}` при ошибке) — Cursor, Copilot, Gemini, Kiro, Windsurf, Antigravity, OpenCode;
- strict (throw с label) — IntelliJ, Hermes (YAML), Codex (TOML malformed diagnostic).

`writeJsonDocument` не должен сам проверять deploy roots: containment остаётся у вызывающего.

**Эффект:** ~120 строк и единый формат файлов.

---

### P1 — основной выигрыш, нужны golden-тесты

#### P1.5. Materialize-session

**Где:** все 13 интеграций.

**Что повторяется:**

```ts
const cwd = resolve(ctx?.cwd ?? process.cwd());
const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
const deployedFiles = [];
const diagnostics = [];
// ...
return { targetId: id, deployedFiles, ...(diagnostics.length ? { diagnostics } : {}) };
```

**Предложение:**

```ts
export type MaterializeRun = {
  primitives: AttributedPrimitiveSet;
  cwd: string;
  roots: string[];
  deployedFiles: DeployedFile[];
  diagnostics: NonNullable<MaterializeReport["diagnostics"]>;
  report(): MaterializeReport;
};

export function createMaterializeRun(args: {
  primitives: AttributedPrimitiveSet;
  ctx?: MaterializeContext;
  defaultDeployRoots: readonly string[];
  targetId: TargetId;
  requiredRoots?: readonly string[];
}): MaterializeRun;
```

**Эффект:** ~10 строк с каждого хоста, единая проверка обязательных roots и единая сборка отчёта.

---

#### P1.6. MCP merge pipeline

**Где:** `normalizeServerEntries` в Cursor, Claude, Codex, Copilot, Gemini, Windsurf, Kiro, Antigravity, OpenCode, Hermes (10 файлов).

**Что повторяется:**

1. массив/record → именованные entries;
2. `pruneManagedMcpServerNames`;
3. replace vs shallow merge;
4. удаление `format` / `packageName` / `registry`;
5. запись секции `mcpServers` / `mcp_servers` / `mcp` / `servers`;
6. opt-in skip, когда каталога хоста нет.

**Предложение:**

```ts
export function normalizeNamedEntries<T extends { name?: string }>(
  input: T[] | Record<string, T>,
): Array<T & { name: string }>;

export function mergeMcpServers(args: {
  document: Record<string, unknown>;
  key?: string; // default "mcpServers"
  incoming: Record<string, Record<string, unknown>>;
  managedServers?: readonly string[];
  merge?: "replace" | "shallow"; // default "replace"
  stripKeys?: readonly string[];
}): {
  document: Record<string, unknown>;
  servers: string[];
  removed: string[];
};

export function skipMcpWhenDirMissing(args: {
  cwd: string;
  dir: string;
  targetId: TargetId;
  code: string;
  label: string;
  configPath: string;
}): ConfigureMcpReport | undefined;
```

**Быстрый фикс:** `integration-hermes/src/createHermesIntegration.ts:275` содержит локальную копию `pruneManagedMcpServerNames`; её можно удалить независимо от остального рефакторинга.

**Граница:** маппинг полей остаётся хостам (`serverUrl`, `httpUrl`, `type: local`, `id`, Codex headers). Общим стоит сделать только транспортную классификацию и merge-механику.

**Эффект:** ~300 строк.

---

#### P1.7. Frontmatter-трансформации

**Где:** `integration-claude:552` (`applyTo` → `paths`), `integration-kiro:364` (`inclusion: fileMatch` + `fileMatchPattern`), `integration-antigravity:158` (`trigger: glob` + `globs`), `integration-codex:217` (agent → TOML), `integration-gemini:207` (command → TOML).

**Что повторяется:** разбор `---`-блока, inline-списки `[a, b]`, блочные списки, кавычки, сохранение body.

**Предложение:**

```ts
export type FrontmatterField = {
  key: string;
  value: string;
  rawLines: string[];
};

export function parseFrontmatter(source: string): {
  fields: FrontmatterField[];
  body: string;
  hasFrontmatter: boolean;
};

export function renderFrontmatter(fields: Array<[string, unknown]>, body: string): string;

export function frontmatterList(field: FrontmatterField | undefined): string[];
```

Хосты описывают только маппинг полей, а не парсер.

**Риск:** высокий — нужен байт-в-байт golden-вывод для трёх rules-трансформаций и двух TOML-трансформаций.

---

#### P1.8. Hook low-level

**Где:** `integration-cursor:386`, `integration-claude:613`, `integration-codex:571`, `integration-copilot:485`, `integration-gemini:355`, `integration-windsurf:284`, `integration-kiro:603`, `integration-antigravity:393`.

**Что повторяется:** чтение source JSON + диагностика, нормализация имени события, копирование скрипта и накопление inventory.

**Предложение:**

```ts
export function normalizeHookEventName(event: string, style: "camel" | "pascal"): string;

export function readHookSource(
  primitive: AttributedPrimitive,
  opts?: { code?: string },
): {
  hooks: Record<string, unknown[]>;
  version?: number;
  diagnostics: NonNullable<MaterializeReport["diagnostics"]>;
};

export function deployHookScript(args: {
  cwd: string;
  deployRoots: string[];
  hookFile: string;
  command: string;
  destDir?: string;
  destRelFor?: (source: string) => string;
  alreadyDeployedNeedle?: string;
  stripInterpreter?: boolean;
  keepInterpreter?: boolean;
  pluginRootToken?: string;
  searchRoots?: string[];
  commandAsDotSlash?: boolean;
}): { commandRel: string; scriptRel?: string };
```

**Почему нужен v2 `copyHookScript`:** локальные копии в Kiro и Antigravity появились именно потому, что общий helper не умеет:

- interpreter-префиксы (`python3`, `node`);
- `${PLUGIN_ROOT}`;
- поиск по нескольким roots и parent-каталогам;
- вычисляемый `destRel` из исходного пути.

**Эффект:** ~150 строк и единая политика ownership/inventory.

---

#### P1.9. Home-scope пути

**Где:** Copilot (`COPILOT_HOME`), Windsurf (`CODEIUM_HOME`), OpenCode (`XDG_CONFIG_HOME`), Hermes (`HERMES_HOME`), IntelliJ (`XDG_CONFIG_HOME` / `LOCALAPPDATA`).

**Предложение:**

```ts
export function resolveEnvHome(envVar: string, fallbackSegments: readonly string[]): string;
export function resolveXdgConfigHome(env?: NodeJS.ProcessEnv): string;
```

IntelliJ-специфика Windows остаётся в хосте, но общая проверка «XDG должен быть абсолютным» уходит в helper.

**Эффект:** небольшой, но убирает расхождения в трактовке относительного XDG и home override.

---

### P2 — структурные, после стабилизации P1

#### P2.10. Полный hook pipeline

6 хостов имеют почти одинаковый скелет:

```
read doc → read sidecar → stripOwnedHookCommands → цикл primitive
→ parse source → merge entries → write doc + sidecar + inventory
```

**Эскиз:**

```ts
export function mergeHookDeployment(args: {
  cwd: string;
  roots: string[];
  hooks: AttributedPrimitive[];
  docPath: string;
  ownershipPath: string;
  mode: "event-map" | "nested-groups" | "container";
  containerKey?: string;
  normalizeEvent?: (event: string) => string;
  defaultMatcher?: string;
  defaultHandlerType?: boolean;
  scriptDestRel: (ctx: {
    hookName: string;
    packageKey: string;
    command: string;
    source: string;
  }) => string;
}): {
  deployedFiles: DeployedFile[];
  diagnostics: NonNullable<MaterializeReport["diagnostics"]>;
  doc: Record<string, unknown>;
};
```

Сложность: Antigravity использует контейнер `bapm`, Copilot и Kiro пишут отдельные файлы на primitive/event. Поэтому только после P1.8.

---

#### P2.11. Skills-only и unsupported-диагностика

**Где:** `integration-agent-skills:42`, `integration-hermes:91`, `integration-grok-bot:43` — одинаковый `skipNonSkill` и одинаковый набор handlers.

**Предложение:**

```ts
export function skillsOnlyHandlers(args: {
  cwd: string;
  deployRoots: string[];
  destDir: string;
  code: string;
  label: string;
  instructionsHint?: string;
}): PrimitiveMaterializeHandlers;

export function unsupportedPrimitiveDiagnostic(args: {
  code: string;
  label: string;
  primitive: AttributedPrimitive;
  kind: string;
  hint?: string;
}): { code: string; message: string; primitive: string; kind: string };
```

**Эффект:** ~100 строк и одинаковые тексты диагностик.

---

#### P2.12. LSP merge

Claude и Copilot почти построчно повторяют `parseLspJson`, `normalizeLspEntries`, ownership-check и prune (~150 строк).

**Предложение:**

```ts
export function mergeLspServers(args: {
  document: Record<string, unknown>;
  key?: string; // default "lspServers"
  incoming: Record<string, Record<string, unknown>>;
  managedServers?: readonly string[];
  ownershipLabel?: string;
}): {
  document: Record<string, unknown>;
  servers: string[];
};
```

Приоритет ниже: всего два хоста, но дублирование почти полное.

---

#### P2.13. Мелочи и контракт

```ts
export function primitivePackageKey(p: AttributedPrimitive): string;
export function safeHookSlug(value: string, fallback?: string): string;
export function resolveIntegrationCapabilities(target: BapmIntegration): {
  mcpEnvMode: McpEnvMode;
  mcpHeadersEnvMode: McpEnvMode;
  mcpScope: "project" | "home";
  supportsGlobalMcp: boolean;
  supportsGlobalFiles: boolean;
};
export function detectAnyPath(
  cwd: string,
  spec: { dirs?: readonly string[]; files?: readonly string[] },
): boolean;
```

- `primitivePackageKey` дублируется в Copilot и Kiro.
- `safeHookSlug` сейчас только в Kiro, но пригодится всем hook-хостам.
- `resolveIntegrationCapabilities` нормализует дефолты контракта: `mcpEnvMode` omit ⇒ bake, `mcpScope` omit ⇒ project.
- `detectAnyPath` убирает повторы в `detect` / `detectGlobal`.

---

## Предлагаемая структура модулей

Сейчас `helpers.ts` — 776 строк и один barrel. После рефакторинга:

| Файл                 | Содержимое                                                         |
| -------------------- | ------------------------------------------------------------------ |
| `src/paths.ts`       | deploy roots, home/XDG, detect helpers                             |
| `src/config.ts`      | `readJsonDocument`, `writeJsonDocument`, `stripJsonc`              |
| `src/compile.ts`     | `compilePrimitivesMarkdown`                                        |
| `src/mcp.ts`         | normalize/merge MCP, env-трансляции, skip-opt-in                   |
| `src/frontmatter.ts` | `parseFrontmatter`, `renderFrontmatter`, `frontmatterList`         |
| `src/hooks.ts`       | source/event/deploy script, полный pipeline                        |
| `src/materialize.ts` | `createMaterializeRun`, `skillsOnlyHandlers`                       |
| `src/helpers.ts`     | существующие helper'ы + re-export новых для обратной совместимости |

`src/index.ts` остаётся единственной публичной точкой входа. Экспорты старых helper'ов не удаляются.

---

## План внедрения

### Волна 1 — P0

1. `paths.ts`: `hasDeployRoot`, `requireDeployRoots`.
2. `compile.ts`: `compilePrimitivesMarkdown`.
3. `mcp.ts`: `translateEnvReferences`, `translateEnvMap`, `hasEnvReference`, `extractEnvReference`.
4. `config.ts`: `readJsonDocument`, `writeJsonDocument`, `stripJsonc`.

Критерий: поведение хостов не меняется, все существующие тесты зелёные.

### Волна 2 — P1

1. `materialize.ts`: `createMaterializeRun`.
2. `mcp.ts`: `normalizeNamedEntries`, `mergeMcpServers`, `skipMcpWhenDirMissing`.
3. `frontmatter.ts`: parse/render/list.
4. `hooks.ts`: `normalizeHookEventName`, `readHookSource`, `deployHookScript` v2.
5. `paths.ts`: `resolveEnvHome`, `resolveXdgConfigHome`.

Критерий: golden-вывод compile/frontmatter совпадает байт-в-байт; хост-тесты не переписаны под новую логику.

### Волна 3 — P2

1. Полный `mergeHookDeployment`.
2. `skillsOnlyHandlers` + `unsupportedPrimitiveDiagnostic`.
3. `mergeLspServers`.
4. `primitivePackageKey`, `safeHookSlug`, `resolveIntegrationCapabilities`, `detectAnyPath`.

---

## Границы и риски

### Что не тащить в API

- **Host-specific destination maps** (Cursor `.mdc`, Kiro steering, Codex TOML agents, Gemini TOML commands) — это и есть суть хоста.
- **Финальный маппинг MCP-полей** (`serverUrl`, `httpUrl`, `type: local`, Codex header indirection) — общим может быть только классификатор транспорта.
- **YAML/TOML-парсеры** — `integration-api` сейчас без runtime-зависимостей; пусть хосты передают уже разобранный документ.
- **`dryRun`** — запрещён спекой `integration-api-contracts`; helpers не должны о нём знать.
- **Host-id allowlists** — API не должен знать имена конкретных интеграций.

### Риски

| Риск                    | Митигация                                                           |
| ----------------------- | ------------------------------------------------------------------- |
| Golden-output drift     | Сначала контрактные тесты helper'ов, затем перевод хостов по одному |
| Over-generalization MCP | Оставить mapper callback; обобщать только merge/transport           |
| Рост публичного API     | Волны, отдельные модули, re-export, semver-политика                 |
| Потеря диагностик       | Helper'ы принимают `code`/`label`; тексты остаются у хостов         |
| Разные scope-семантики  | Project/home/global оставить явными флагами, не выводить магически  |
| Дублирование тестов     | Один набор contract-тестов на helper + существующие host-тесты      |

---

## Критерии приёмки

1. `vp check` и `vp test` зелёные во всех затронутых пакетах.
2. Существующие host-тесты не меняют ожидаемое поведение (допустимы только импортные правки).
3. Для каждого нового helper'а есть contract-тест в `packages/integration-api/tests`.
4. В `integration-api` нет имён конкретных хостов и host-id allowlists.
5. Нет новых runtime-зависимостей в `integration-api`.
6. Compile/frontmatter golden-вывод байт-в-байт совпадает.
7. По каждой волне зафиксирован LOC-delta по `integration-*` и список удалённых локальных копий.

## Оценка эффекта

- Сокращение повторяющейся обвязки: ориентировочно **800–1000 строк** после трёх волн.
- Новый хост: вместо 400–850 строк — в основном карта назначений, transform и транспортные особенности; ориентир **150–250 строк**.
- Надёжность: один аудит env/headers, одна семантика deploy roots, один способ писать JSON-конфиги.

## Приложение: быстрые победы без ожидания волн

1. Удалить локальный `pruneManagedServers` в `integration-hermes:275` и импортировать `pruneManagedMcpServerNames`.
2. Заменить `roots.some(...)` на общий guard даже до полного рефакторинга — это локальное изменение на 1–3 строки в файле.
3. Вынести `packageKey` из Copilot/Kiro в `primitivePackageKey`.
4. Свести `readExistingMcpDoc` к одному helper'у в пределах одной волны.
