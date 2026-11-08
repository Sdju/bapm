# Changelog

## 0.3.0 — 2026-11-09

Первый minor после 0.2.1: паритет с microsoft/apm 0.35, новые хосты, global scope и усиление trust.

### Added

- **14 host integrations**: `grok-bot`, `hermes`, `intellij` добавлены к cursor/claude/codex/copilot/opencode/windsurf/gemini/kiro/grok-build/antigravity/agent-skills.
- **Global user scope**: `bapm install --global` для file primitives (Cursor/Claude/Codex/agent-skills) и MCP (Cursor/OpenCode); `bapm compile --global` для Cursor/Claude/Codex. Manifest/lock — в `~/.bapm` (`BAPM_HOME`).
- **MCP parity**: multi-target configure, HTTP `headers`, native `${env:VAR}`/`{env:VAR}` для Cursor/OpenCode, registry `mcp search/show/install`, lock inventory, deny prune, global MCP warning.
- **Trust**: ExecutableTrust для MCP/bin/hook/LSP, per-package grants, `approve --list/--pending/--all`, `approve/deny --bin/--hook/--lsp`; deny удаляет уже записанные host-серверы.
- **Policy**: GitHub multi-candidate (`.github-private → .github → .apm → _apm`), Azure DevOps org-policy, `BAPM_EXTRA_CA_BUNDLE`/`NODE_EXTRA_CA_CERTS`.
- **Compile**: `--target a,b`/`--all`, distributed `applyTo`, deterministic Build ID, `--clean`, `--watch`.
- **Pack/marketplace**: `--check-clean`, `--strict-metadata`, Claude plugin bundle, Copilot marketplace output, portable plugin declared-path validation, peeled annotated-tag `source.sha`.
- **CLI**: `auth`, `targets`, `config` keys, `runtime list/status`, `run`/`preview`, `init --discover`, read-only `mcp` inventory, `cache prune`, shared git/HTTP cache.

### Fixed

- Manifest: `kiro`/`grok-build` targets, `vscode`/`agents` aliases, scalar/CSV `targets`, `$schema` negotiation, unknown-key warnings, dependency `extensions`, immutable literal refs.
- Install: `uninstall` exact identity, project-relative `path`, local single-file deps, frozen under-record, path traversal/ownership conflicts.
- Lifecycle: `update -y` в CI требует `--force`; `deps why --json` корректный `is_direct`; update dry-run резолвит refs.
- MCP: registry-only entries fail-closed, Codex headers, secret placeholders, stale/deny cleanup.
- Hooks: native nested shapes для Codex/Claude.
- CLI/tests: 5 cursor-resolve тестов, HOME isolation, help/docs/specs aligned with shipped behavior.

### Changed / BREAKING

- **bin/**: TTY больше не даёт неявного согласия; нужен `--trust-bin` или persisted `bin: true`.
- **MCP secrets**: Cursor/OpenCode пишут runtime placeholders; literal — только через `{bake:VAR}`.
- **`--no-policy`**: отключает только repo policy; org deny остаётся; полный escape — `--no-policy-all`/`BAPM_POLICY_DISABLE`.
- **Frozen**: lock должен записывать развёрнутые файлы; local content hash обязателен.
- **`update` в CI**: требует `--force`.
- **Hooks**: dependency hooks гейтятся при наличии grant surface/org deny.
- **Global scope**: `-g` без `--only mcp` теперь ставит file primitives для поддерживаемых хостов; unsupported hosts fail closed.
- **Compile**: вывод получает `<!-- Build ID: ... -->`; `--clean` удаляет только валидные generated-файлы.

## 0.2.1 — 2026-11-08

### Fixed

- **Published package manifests.** `0.2.0` shipped `workspace:*` / `catalog:` dependency specifiers that npm cannot install. `0.2.1` publishes rewritten manifests via `pnpm publish`. Use `0.2.1` instead of `0.2.0`.

## 0.2.0 — 2026-11-08

### Added

- **Git virtual packages.** `git:` dependencies may carry `path:` for a package inside a monorepo/subdirectory. Resolution reads the manifest, primitives, child dependencies, and `tree_sha256` from that subdirectory and writes `virtual_path` to the lock (#30).
- Host runtimes for Gemini, Kiro, Grok Build, Antigravity, OpenCode, Agent Skills, and Copilot native Agent Plugins.
- Manifest presets, personal `bapm.local.lock.yaml`, commands/hooks primitives, and `pack --check-versions` marketplace alignment.
- Canonical repository-identity casing for policy allow/deny/require matching.

### Fixed

- **Install from a pack archive is additive.** Existing project files are preserved; a differing file fails closed before any member is written (#33 follow-up).
- **Git downloads are idempotent.** A checkout already at the requested commit is reused; stale trees are replaced via a temp clone and atomic swap (#32).
- **MCP lock inventory keeps authored placeholders.** Baked `${VAR}` / `{bake:VAR}` values no longer reach the lockfile; stale root-owned inventory is scrubbed on non-frozen installs.
- **Verbose install errors print the cause chain.** `--verbose` / `-v` now shows the underlying error instead of only `Failed to download` (#31).
- CLI help no longer leaks internal requirement IDs or milestone labels.

### Changed

- User documentation, README, and integration READMEs were rewritten against shipped behavior.
- OpenAPM spec deltas were synced and the conformance statement regenerated for the per-host integration matrix.

### BREAKING — portable `plugin.json` `skills:` is exclusive

Aligned with APM 0.29 plugin exclusive skills:

- **Omit** `skills` → keep conventional discovery of immediate `skills/<name>/SKILL.md`.
- **`"skills": []`** → deploy **zero** skills even when `skills/` exists (shadow diagnostic when conventional entries are present). Omit the key to restore discovery.
- **Non-empty list** → only resolved declared names / `skills/<name>` / container `skills`|`./skills`; missing, unknown, traversal, or escape **fail closed** before deploy/lock commit.

**Not the same as** consumer object-form dependency `skills:` (deps-object-subset): an empty list on a dependency entry remains a **manifest parse error** and does not mean “deploy all plugin skills”. Exclusive plugin declaration runs first; consumer subset may further narrow the result.
