## Why

bapm has no Grok Build runtime host, so projects with `.grok/` cannot install APM-aligned rules/agents/commands/skills or compile project `AGENTS.md`. APM already defines `KNOWN_TARGETS["grok-build"]`; bapm needs a matching opt-in package next.

## What Changes

- Add greenfield `@bapm/integration-grok-build` exporting `createGrokBuildIntegration` / `createIntegration` (`id: "grok-build"`).
- Detect **only** when `.grok/` is a directory (no mkdir for detect; lone `AGENTS.md` is not a signal).
- Materialize under `.grok/`: instructions → `rules/*.md` (verbatim), agents → `agents/*.md`, commands → `commands/*.md` (shared Claude-subset frontmatter), skills → `skills/<name>/SKILL.md` (never `.agents/skills/`).
- Explicit non-fatal skip for hooks and prompts (APM N); **no** `configureMcp` (APM N).
- Host `compile` → project-root `AGENTS.md` (agents compile family; shared last-writer collision with Cursor/Codex).
- Docs: supported-hosts + architecture index for opt-in object-map load.
- Package/unit + acceptance tests covering detect, materialize kinds, skips, compile.

**Non-goals:** experimental `grok-cloud`; user-scope `~/.grok/**`; MCP/hooks/prompts writers; rich APM AGENTS.md polish; CLI eager registration.

## Capabilities

### New Capabilities

- `integration-grok-build-runtime`: Grok Build project-scope runtime on `@bapm/integration-grok-build` — detect `.grok/` only, materialize rules/agents/commands/skills under `.grok/`, skip hooks/prompts/MCP, compile root `AGENTS.md`.

### Modified Capabilities

- `compile-agents-md`: Allow grok-build host compile emission of shared-family `AGENTS.md` when the integration exposes `compile`; keep cursor-default “no foreign-host side effects” intent; document shared-path collision with Cursor/Codex.

## Impact

- New package: `packages/integration-grok-build` (depends on `@bapm/integration-api` only among bapm packages).
- Docs: `supported-hosts`, architecture index.
- CLI remains empty-registry / object-map load unchanged.
- Tests in the new package (+ light docs updates).
