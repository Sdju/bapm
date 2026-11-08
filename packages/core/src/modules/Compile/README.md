# Compile

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Discover primitives → emit deterministic instruction files for one or several registered compile-capable hosts.

## Public API

- `compileAgentsMd` / `compileProject` / `runCompile` / `emitAgentsMd`
- Options: `validate` (no durable write), `dryRun`, `verbose`, `cwd`, `outputFile`,
  `forcedTarget` (single), `forcedTargets` (comma-separated ids from `--target a,b`), `all` (`--all`),
  `distributed` (opt-in `applyTo` placement), `clean` (orphan generated-output cleanup)
- Result: single-target `path` / `content` / `wrote` stay for compatibility; `outputs` lists
  `{ targetId, path, wrote }` for every emitted output (multiple outputs per host in distributed mode)

## Multi-target safety

- `forcedTargets` / `all` emit one target-owned file per selected host per placement directory.
- `outputFile` is rejected with more than one host and in distributed mode.
- If two selected hosts resolve to the same output path (for example `AGENTS.md` for Cursor,
  Codex, OpenCode, Kiro, Grok Build, Hermes, and Antigravity), compile fails closed and lists
  every colliding host and the path. It never silently overwrites.

## Distributed mode (conservative subset)

`distributed: true` reads instruction `applyTo` (scalar, comma list, or YAML list; `globs` is
accepted as an alias) and uses each pattern's literal directory prefix:

- `src/**`, `src/**/*.ts`, `src/foo.ts` → `src/`
- `docs/*.md` → `docs/`
- `**/*.ts`, `*.ts`, `{src,lib}/**`, bare names → project root

Each selected host keeps its default basename and prefix (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
`.github/copilot-instructions.md`), so `src/**` becomes `src/AGENTS.md` for Cursor and
`.github/src/copilot-instructions.md` for Copilot. Global/unmatched instructions and every
non-instruction primitive stay in the root output; an empty root shell is suppressed when all
instructions are placed below the root. Unsafe patterns (absolute, `..`, control directories)
and symlinked output paths fail closed before any write. Full APM context-optimizer placement
(file-match scoring, inheritance analysis) is not implemented.

## Build ID and clean

Every output ends with `<!-- Build ID: <12 hex> -->`, hashed over normalized content
excluding the marker. `clean: true` removes orphaned target-shaped outputs that are absent
from this run's planned set and still carry a matching Build ID; `dryRun` previews removals
and `validate` suppresses cleaning. Hand-authored and edited generated files are never
deleted. `clean` uses the same target selection as compile, so `--target` is not required
when `active` / config / sole detect applies.

## Watch

`watchCompile({ compile, ... })` runs one compile, then asks a watch factory to report changed
paths and recompiles after a debounce window (`DEFAULT_COMPILE_WATCH_DEBOUNCE_MS`, 200 ms).
The CLI passes a compile callback so registry selection and output printing stay there.
Runs are serial: an event during an active compile queues one follow-up. Compile errors are
reported and do not stop the loop. `signal` stops the loop and closes the watcher; `once: true`
runs only the initial compile. Tests inject `watchFactory` and/or `resolveTargets`.
`resolveCompileWatchTargets` covers manifests, `.apm/`, `apm_modules/`, root skills/hooks/prompts,
`.agents/local/`, and local dependency directories.

## Non-goals

Full APM optimizer placement, `--global`, and APM prompt compiler behavior remain out of scope.
`--watch` does not install dependencies or refresh git packages in `apm_modules`; run
`bapm install` separately.
