# Compile

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Discover primitives → emit deterministic instruction files for one or several registered compile-capable hosts.

## Public API

- `compileAgentsMd` / `compileProject` / `runCompile` / `emitAgentsMd`
- Options: `validate` (no durable write), `dryRun`, `verbose`, `cwd`, `outputFile`,
  `forcedTarget` (single), `forcedTargets` (comma-separated ids from `--target a,b`), `all` (`--all`)
- Result: single-target `path` / `content` / `wrote` stay for compatibility; `outputs` lists
  `{ targetId, path, wrote }` for every selected host

## Multi-target safety

- `forcedTargets` / `all` emit one target-owned file per selected host in one invocation.
- `outputFile` is rejected when more than one host is selected (one path cannot be shared).
- If two selected hosts resolve to the same output path (for example `AGENTS.md` for Cursor,
  Codex, OpenCode, Kiro, Grok Build, Hermes, and Antigravity), compile fails closed and lists
  every colliding host and the path. It never silently overwrites.

## Non-goals

Per-path `applyTo` placement, `--watch`, `--clean`, `--global`, and APM prompt compiler
behavior remain out of scope.
