# Паритет bapm ↔ microsoft/apm — новый раунд

**Дата:** 09.11.2026  
**bapm:** `0.2.1`, текущий HEAD ветки `docs/report-discrepancies-audit`  
**APM:** `v0.35.0` (`17a2fc4d`, 2026-10-22), `.samples/apm`

Анализ read-only: код, спеки, docs и changelog. Runtime-поведение, помеченное «не проверено», требует отдельного acceptance-теста.

## Метод

1. Обновлён референс APM до `v0.35.0`; разобраны 737 коммитов и 9 релизов после `0.27.0`.
2. Сверены 10 осей: manifest, lockfile, resolve, install/adapters, MCP, compile, policy/trust, CLI surface, registry/marketplace, pack/plugin.
3. Отдельно проверены новые фичи APM 0.31–0.35: `replace:`, `auth`, user-scope, `grok-bot`, Copilot marketplace, `APM_EXTRA_CA_BUNDLE`, frozen no-write, native hooks/headers.
4. Для каждого расхождения — verdict, влияние, приоритет, evidence.

## Вердикт

| Ось                  | Verdict | Комментарий                                                                                                         |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| manifest             | partial | `$schema`, scalar/CSV targets, неизвестные ключи, extensions, immutable refs — сделано; full `replace:` не ratified |
| lockfile             | partial | local wire (`local_path`, `content_hash`), v3 diagnostics; full `replacements` — отложено                           |
| resolve              | diverge | bapm ∩-pick (OpenAPM) vs APM first-wins — осознанно                                                                 |
| install/adapters     | partial | 14 хостов; нет user-scope и LSP deploy                                                                              |
| MCP                  | partial | multi-target, headers, inventory, deny prune — есть; registry lookup и `mcp install` — нет                          |
| compile              | partial | multi-target, `applyTo`/distributed — есть; build-id/watch/clean — нет                                              |
| policy/trust         | partial | ADO/multi-candidate, approve all/pending/list — есть; LSP/canvas deploy — нет                                       |
| CLI surface          | partial | auth/targets/config/mcp/run/runtime/init — есть; user-scope, runtime setup/remove, experimental, view -g — нет      |
| registry/marketplace | partial | Copilot output — есть; registry host N/A, HTTP cache — нет                                                          |
| pack/plugin          | partial | check-clean/strict-metadata/Claude bundle/portable validation — есть; annotated tag pin — нет                       |

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

Проверки: core 260 файлов / 1382 теста, CLI 125 / 643, `vp check` 0 ошибок, conformance/specs OK. Остались P2-кластеры ниже (user-scope/global, runtime setup/remove, registry MCP lookup, canvas/LSP deploy, view -g).

### Пачка 8 (09.11.2026)

| Что                                | Статус                          | Коммит    |
| ---------------------------------- | ------------------------------- | --------- |
| `compile --watch`                  | fixed                           | `5d160cc` |
| Registry MCP `search/show/install` | fixed (conservative conversion) | `7fa9c81` |

Проверки: core 283 файла / 1577 тестов, CLI 145 / 811, `vp check` 0 ошибок, conformance/specs OK.

### Пачка 7 (09.11.2026)

| Что                                                   | Статус | Коммит    |
| ----------------------------------------------------- | ------ | --------- |
| Annotated tag `source.sha` → peeled commit            | fixed  | `1eb454f` |
| Compile deterministic Build ID + `--clean`            | fixed  | `7dad385` |
| Shared HTTP cache (`cache info/clean/prune --shared`) | fixed  | `308281c` |

Проверки: core 281 файл / 1558 тестов, CLI 143 / 795, `vp check` 0 ошибок, conformance/specs OK.

### Пачка 6 (08.11.2026)

| Что                                                                       | Статус                                   | Коммит    |
| ------------------------------------------------------------------------- | ---------------------------------------- | --------- |
| `config` key set: target, mcp-registry-url, temp-dir, self-update.channel | fixed (stored-only consumers documented) | `54c2e69` |
| `cache prune --shared`                                                    | fixed                                    | `ac1a3ee` |
| `runtime list/status` read-only                                           | fixed (setup/remove deferred)            | `8bc38df` |

Проверки: core 278 файлов / 1522 теста, CLI 141 / 782, `vp check` 0 ошибок, conformance/specs OK.

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

## Остаток

Актуальный замороженный список: [`remaining.md`](remaining.md).

- **Actionable:** user-scope/global install, LSP deploy.
- **Follow-up уже принятых решений:** stored-only config keys, `runtime setup/remove`, `view -g`, lifecycle executor, experimental CLI, `mcp install`, canvas.
- **Намеренно не делаем / N/A:** resolve ∩-pick, lock sort, full `replace`, manifest-v0.1.48, registry host, APM installer/gh-aw/contributor dashboard, project-default approve.

Правило: новый пункт не попадает в «Осталось» автоматически из risk-заметки субагента; сначала классификация actionable / follow-up / N/A.

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
