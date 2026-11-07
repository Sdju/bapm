# Changelog

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
