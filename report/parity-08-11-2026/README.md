# Паритет bapm ↔ microsoft/apm — новый раунд

**Дата:** 08.11.2026  
**bapm:** `0.2.1`, HEAD `2e55597`  
**APM:** `v0.35.0` (`17a2fc4d`, 2026-10-22), `.samples/apm`

Анализ read-only: код, спеки, docs и changelog. Runtime-поведение, помеченное «не проверено», требует отдельного acceptance-теста.

## Метод

1. Обновлён референс APM до `v0.35.0`; разобраны 737 коммитов и 9 релизов после `0.27.0`.
2. Сверены 10 осей: manifest, lockfile, resolve, install/adapters, MCP, compile, policy/trust, CLI surface, registry/marketplace, pack/plugin.
3. Отдельно проверены новые фичи APM 0.31–0.35: `replace:`, `auth`, user-scope, `grok-bot`, Copilot marketplace, `APM_EXTRA_CA_BUNDLE`, frozen no-write, native hooks/headers.
4. Для каждого расхождения — verdict, влияние, приоритет, evidence.

## Вердикт

| Ось                  | Verdict | Комментарий                                                                                          |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| manifest             | partial | dual-read, но нет `$schema`; `replace:` игнорируется; токены `kiro`/`grok-build` не приняты          |
| lockfile             | partial | v1/v2; нет `replacements`/v3 и APM local wire (`local_path`, `content_hash`)                         |
| resolve              | diverge | bapm ∩-pick (OpenAPM) vs APM first-wins; нет immutable-ref equivalence                               |
| install/adapters     | partial | 11 хостов vs 18 APM target ids; нет user-scope; frozen под-учёт файлов                               |
| MCP                  | partial | multi-target/headers/lock inventory/deny prune есть; registry MCP, Codex headers и secret bake — нет |
| compile              | partial | один файл на запуск, 9 хостов; нет applyTo/distributed/build-id/watch                                |
| policy/trust         | partial | local + GitHub org, per-package grants; нет ADO/multi-candidate, LSP/canvas, полного approve UX      |
| CLI surface          | partial | lifecycle/marketplace есть; нет `auth`, `mcp`, `targets`, `config`, `run`, `global`                  |
| registry/marketplace | partial | registry client за флагом, host N/A; нет Copilot marketplace output                                  |
| pack/plugin          | partial | zip + Agent Plugins; нет `--check-clean`/`--strict-metadata`, Claude bundle, hooks/assets producer   |

## Приоритеты

### P1 — исправлять первыми

| #   | Проблема                                                                                  | Файл                                            |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `target`/`targets` не принимают `kiro` и `grok-build`; `vscode`/`agents` не нормализуются | [p1-fixes.md](p1-fixes.md#1-target-tokens)      |
| 2   | MCP-секреты бейкаются в Cursor/OpenCode вместо native `${env:VAR}`/`{env:VAR}`            | [p1-fixes.md](p1-fixes.md#2-mcp-secret-bake)    |
| 3   | Codex теряет HTTP `headers` у remote MCP                                                  | [p1-fixes.md](p1-fixes.md#3-codex-headers)      |
| 4   | Registry-only MCP пишется как невалидный stdio-сервер вместо fail-closed                  | [p1-fixes.md](p1-fixes.md#4-registry-mcp)       |
| 5   | Frozen не падает, если lock не записывает развёрнутые файлы; local snapshot не хешируется | [p1-fixes.md](p1-fixes.md#5-frozen-underrecord) |
| 6   | Local lock wire несовместим с APM: нет `local_path`/`content_hash`/`depth`/`resolved_by`  | [p1-fixes.md](p1-fixes.md#6-local-lock-wire)    |
| 7   | `replace:` молча игнорируется, lock v3 отвергается generic-ошибкой                        | [p1-fixes.md](p1-fixes.md#7-replace-v3)         |
| 8   | Нет TLS/CA-политики: корпоративные PEM и `NODE_EXTRA_CA_CERTS` не описаны                 | [p1-fixes.md](p1-fixes.md#8-tls-ca)             |

### Статус после массовой правки (08.11.2026)

| P1                                             | Статус                        | Коммит    |
| ---------------------------------------------- | ----------------------------- | --------- |
| target tokens                                  | fixed                         | `b3d3f48` |
| MCP secret bake / Codex headers / registry MCP | fixed                         | `d0ee7a0` |
| frozen under-record                            | fixed                         | `6170251` |
| local lock wire                                | fixed                         | `a769c9b` |
| replace/v3 diagnostics + TLS/CA                | fixed (full replace deferred) | `8ab5fe9` |
| P2 targets/config/lifecycle                    | fixed                         | `e686568` |
| P2 Copilot marketplace + check-clean           | fixed                         | `2b7c517` |

Проверки: core 260 файлов / 1382 теста, CLI 125 / 643, `vp check` 0 ошибок, conformance/specs OK. Остались P2-кластеры ниже (user-scope/global, runtime, registry MCP lookup, canvas/LSP deploy, полный config key set).

### Пачка 5 (08.11.2026)

| Что                                                 | Статус | Коммит    |
| --------------------------------------------------- | ------ | --------- |
| `bapm run` / `bapm preview` для manifest `scripts:` | fixed  | `45692c6` |
| Claude plugin bundle: `pack --format claude-plugin` | fixed  | `5250b30` |
| Compile `--distributed` / `applyTo` placement       | fixed  | `63fae95` |

Проверки: core 277 файлов / 1513 тестов, CLI 139 / 759, `vp check` 0 ошибок, conformance/specs OK.

### Пачка 4 (08.11.2026)

| Что                                                          | Статус | Коммит    |
| ------------------------------------------------------------ | ------ | --------- |
| `approve --all/--recommended` (pending → grants)             | fixed  | `6425656` |
| `compile --target a,b` / `--all`, collision fail-closed      | fixed  | `56a8d29` |
| Portable plugin pack: declared paths/hooks/assets validation | fixed  | `72137ec` |
| Opt-in shared git mirror cache (`BAPM_CACHE_DIR`)            | fixed  | `fbe79f5` |

Проверки: core 274 файла / 1490 тестов, CLI 136 / 735, `vp check` 0 ошибок, conformance/specs OK.

### Пачка 3 (08.11.2026)

| Что                                  | Статус | Коммит    |
| ------------------------------------ | ------ | --------- |
| `bapm auth HOST [--check/--export]`  | fixed  | `000281b` |
| `approve --list/--pending` read-only | fixed  | `09432d2` |
| `init --discover` + safe `--apply`   | fixed  | `ef33b93` |
| Local single-file primitive deps     | fixed  | `55ea6a6` |
| Hosts `hermes` + `intellij`          | fixed  | `0b7df54` |
| `pack --strict-metadata` (exit 5)    | fixed  | `cdcc374` |

Проверки: core 270 файлов / 1463 теста, CLI 132 / 708, `vp check` 0 ошибок, conformance/specs OK.

### Пачка 2 (08.11.2026)

| Что                                                                             | Статус | Коммит    |
| ------------------------------------------------------------------------------- | ------ | --------- |
| Codex/Claude native hook shapes                                                 | fixed  | `509b594` |
| `$schema`, targets scalar/CSV, unknown-key warnings, extensions, immutable refs | fixed  | `a6458c0` |
| GitHub multi-candidate + Azure DevOps policy discovery                          | fixed  | `c4698a9` |
| LSP/canvas explicit diagnostics                                                 | fixed  | `9ac3506` |
| Read-only `bapm mcp list/show/search`                                           | fixed  | `1d9e3b1` |
| `grok-bot` host integration                                                     | fixed  | `efd5bc9` |

Обновлённые проверки: core 268 файлов / 1447 тестов, CLI 127 / 660, `vp check` 0 ошибок, conformance/specs OK.

## P2 — паритетные разрывы

- User-scope/global install и native user MCP.
- `bapm auth`, `targets`, `config`, `mcp`, `init --discover`, `run/preview`, `runtime`, `lifecycle`.
- Approve/deny: APM project-default + `--pending/--all/--recommended`; bapm user-only.
- Native hook shapes: Codex nested, Claude nested/typed.
- Compile: multi-target, `applyTo`, distributed dirs, build-id, `--watch/--clean`.
- Pack: `--check-clean`, `--strict-metadata`, Claude bundle, plugin hooks/assets.
- Copilot marketplace output.
- Missing stable hosts: `hermes`, `intellij`, `grok-bot`; experimental — defer.
- Policy ADO/multi-candidate; LSP/canvas gates.
- Lock sort/identity interop, `$schema`, unknown-key warnings, `targets` scalar/CSV.
- Shared git/http cache; registry MCP CLI.

Подробности: [p2-gaps.md](p2-gaps.md).

## Что уже паритет или сильнее APM

- 11 host integrations, project-scope materialize, MCP multi-target configure.
- MCP `headers`, env bake/translate, lock inventory, deny prune.
- Per-package grant surface, hooks/bin/MCP trust, deny-wins, `approve/deny --bin/--hook`.
- Local + `github-owner-dotgithub` policy через CLI fetcher; `--no-policy` безопаснее APM.
- Project-relative `path`, frozen ref drift, CI update gate.
- `find`/`search`/`view`/`self-update`/`cache`/`deps why`/`deps tree`.
- One-file compile — осознанное отличие, не баг.

## N/A и отложенное

- `replace:` и manifest-v0.1.48 — **unratified** у самого APM; не тащить контракт вслепую.
- Registry host — product decision, bapm его не заявляет.
- `unpack`, `experimental`, APM installer/Homebrew/Authenticode, gh-aw, contributor dashboard — вне bapm.
- Canvas — primitive path отсутствует; держать soft и честно документировать.
- Shared APM cache — N/A или отдельное решение.

## Ограничения анализа

- Runtime не запускался; статические выводы помечены в карточках.
- APM `origin/main` на 1 коммит впереди `v0.35.0` (perf #3370); анализ по тегу.
- «Registry host» у APM трактуется как package-registry server; APM ship-ит client, host не заявлен.
