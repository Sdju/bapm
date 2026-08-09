# Plan: host selection happy path (canonical integrations)

> OpenSpec: **skipped** (user: «трогать openspec не нужно»).  
> Change slug: `docs-host-happy-path`  
> Branch: `orch/docs-host-happy-path`

## Goal

Сделать честный happy path: `bapm install` → найти агента → стандартный `@bapm/integration-*` → materialize. Object-map `targets:` — только override/add custom, не prerequisite существования host'а. Документация переписывается под эту модель (после кода).

## Mental model (5 lines)

1. `bapm install` ищет агента (detect / active / `--target`).
2. Для известного host id BAPM пробует canonical `@bapm/integration-<id>`.
3. Пакет должен быть установлен (global/project); BAPM не бандлит integrations в CLI.
4. Materialize в layout агента.
5. Escape hatches: `--target` / `bapm.local.yml` (`active`) / `targets:` (custom impl).

## Развести три понятия

| Понятие   | Роль                                                                 |
| --------- | -------------------------------------------------------------------- |
| **detect**  | auto: интеграция говорит «этот cwd похож на мой host»              |
| **active**  | explicit choose: какой host(ы) активны (base и/или local overlay)  |
| **targets** | replace/add integration **impl** (host id → package specifier)     |

`targets:` **не** активирует host и **не** обязателен для canonical hosts.

## P0 — Code (MUST before honest docs)

### Current gap

- CLI registry стартует пустым (`createCliIntegrationRegistry`).
- `registerManifestIntegrationsFromCwd` регистрирует **только** entries из object-map; без map → пустой registry → detect/install бесполезны.
- Docs/README сегодня учат «поставь пакет + объяви `targets:`» — это следствие бага модели, не продукт.

### Target behavior

1. **Canonical host table** (в CLI или shared helper): известные host ids → default specifier `@bapm/integration-<id>` (cursor, opencode, copilot, windsurf, kiro, grok-build, antigravity, agent-skills, claude, codex, gemini, … — по фактическим `packages/integration-*`).
2. **`registerManifestIntegrationsFromCwd` / load path:**
   - если map есть — load map values (override/replace per key; custom keys allowed);
   - для canonical hosts **без** map entry — попытка resolve+load `@bapm/integration-<id>` (fail soft per host если пакет не установлен: host просто не регистрируется / detect его не видит);
   - map **absent** ≠ «нет hosts»: canonical fallback всё равно работает.
3. **Host selection precedence** (уже близко в core; сохранить/закрепить):
   - `--target` → local `active` → base `active` → sole auto-detect → ambiguity/missing **fail-closed**.
4. **Separate resolution** (impl package):
   - explicit map value → else canonical `@bapm/integration-*`.
5. **`bapm init`:** может по-прежнему писать map+active для pin, но это не единственный путь; happy path без map допустим после detect.
6. Не менять OpenSpec specs в этом change (user request); поведение выровнять в коде + user docs.

### Packages likely touched

- `packages/cli` — `loadManifestIntegrations.ts`, `registry.ts`, enrich messages, init messaging, tests.
- Possibly thin helper in `packages/integration-api` if canonical id list belongs there (prefer keep list near CLI load path unless API already owns host ids).
- `packages/core` — only if selection/error copy needs alignment; prefer not broaden Install unless needed.

## P0 — Docs (after code; doc-expert style)

Files (primary): `apps/docs/**`, root `README.md` as needed.

- Happy path first: install → find agent → standard integration → materialize. **NOT** targets/object-map first.
- One loud formulation of detect / active / targets.
- `active` via real scenarios: ambiguous detect; pin agent; team via `bapm.local.yml` (overlay; local active replaces; don't commit).
- `bapm.local.yml` first-class: shared deps in `bapm.yml` → Vasya Cursor / Masha Claude via local `active` → agent-neutral base manifest.
- Docs MUST match implementation.

Touch likely: `index.md`, `guide/quick-start.md`, `guide/supported-hosts.md`, `guide/config-manifest.md`, `guide/manifest-hosts.md`, `guide/manifest-overlay.md`, situations that mention `targets:` as prerequisite, `README.md`.

## P1 — Docs

- Custom `targets:` → Advanced / Extensibility; main Cursor example = write nothing (no map).
- New page **How host selection works**:
  - precedence `--target` → local active → base active → auto-detect → ambiguity error;
  - SEPARATE: explicit map → canonical `@bapm/integration-*`.
- Open-world vs closed allowlist (`integration-api` product value).
- Security: integration package = trusted executable dep; BAPM doesn't sandbox npm; separate from MCP trust/policy/frozen/hashes.
- Rebuild Supported Hosts table: Host | Auto-detect | Canonical package | Explicit-only? | Override below.

## P2 — Docs

- Harden User docs vs Integration author docs split.
- Scenario-first: solo one agent / team different agents / force agent / custom agent.
- Ambiguous detect (`.cursor` + `.claude`) fail-closed + solutions.
- base `active` (team policy) vs local `active` (dev preference).

## Out of scope

- OpenSpec propose/archive/sync.
- Sandboxing npm / changing MCP policy model.
- Bundling all integrations into `@bapm/cli` as hard deps (registry stays dynamic resolve).

## Acceptance criteria (for next phase: RED suite)

1. Without object-map `targets:`, with `@bapm/integration-cursor` resolvable and sole Cursor detect markers in cwd, `bapm install` selects `cursor` and materializes (no `--target` required).
2. Without map and without installed canonical package for detected host → clear fail / guidance (not silent empty success that claims deploy).
3. Object-map entry overrides canonical specifier for that host id; other canonical hosts still load via fallback.
4. Custom host id only via map (or explicit register path); unknown id without map entry stays unregistered.
5. Host selection precedence: `--target` wins over local `active` wins over base `active` wins over sole detect; multi-detect / multi-active without `--target` fail-closed.
6. `bapm.local.yml` `active` replaces base `active` for selection (existing overlay semantics preserved).
7. Docs P0 pages no longer require `targets:` for Cursor happy path; detect/active/targets formulated once; local overlay team scenario present.
8. (P1 as tests or doc checks if automated) Supported Hosts table columns and selection page exist; security note present.

## Suggested apply order

1. Code + CLI tests (canonical fallback load).
2. Docs P0 + README.
3. Docs P1 (new selection page, table, advanced targets).
4. Docs P2 polish / scenarios.
