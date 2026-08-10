## Context

`@b-apm/integration-opencode` already implements detect, skill/agent/command materialize under `.opencode/`, hooks skip (`OPENCODE_HOOKS_UNSUPPORTED`), and MCP → project `opencode.json`. Instruction primitives are silently skipped today; Cursor/Codex already share project-root `AGENTS.md` via `compile`. See proposal.md for motivation. Spec delta: `specs/integration-opencode-runtime/spec.md`.

## Goals / Non-Goals

**Goals:**

- Mirror Codex/Cursor `compile` shape in OpenCode: default `AGENTS.md`, include instructions, basename allowlist, write/preview intent, deterministic section order.
- Keep `.` deploy root covering both `opencode.json` (MCP) and root `AGENTS.md` (compile) with hard-limited writers.
- Update package README + user docs so OpenCode is listed in the `AGENTS.md` last-writer family.

**Non-Goals:**

- User-scope OpenCode config (`~/.config/opencode/`).
- Enabling hooks.
- Moving skills from `.opencode/skills/` to APM `.agents/skills/`.
- Merging multi-host `AGENTS.md` content across Cursor/Codex/OpenCode.

## Decisions

1. **Reuse Codex/Cursor AGENTS.md renderer pattern**  
   Implement `compile` on `createOpencodeIntegration` calling a local `compileOpencodeAgentsMd` + `renderOpencodeAgentsMd` (same section shape: `# AGENTS.md`, generated banner, `## name (type)` + body, sorted by type/name/path). Prefer copy-adapt over extracting a shared helper in this change to avoid a cross-package refactor.  
   _Alternatives considered:_ shared helper in `integration-api` — deferred; three hosts already duplicate lightly.

2. **Instructions stay compile-only**  
   Materialize continues to skip native instruction/rules files. Add an optional non-fatal diagnostic (e.g. `OPENCODE_PRIMITIVE_UNSUPPORTED` / compile-only message) for instructions, matching Codex honesty without failing install. Hooks keep existing `OPENCODE_HOOKS_UNSUPPORTED`.

3. **Detect unchanged; AGENTS.md is not a signal**  
   Do not treat lone `AGENTS.md` as OpenCode presence (shared compile artifact). Detect remains `.opencode/` directory **or** `opencode.json` / `opencode.jsonc`.

4. **Skills path stays `.opencode/skills/`**  
   APM matrix may mention `.agents/skills/` for some hosts; OpenCode v1 already ships `.opencode/skills/`. Aligning would be a separate materialize change — out of scope unless a future APM parity epic requires it.

5. **Docs touchpoints**  
   Update `supported-hosts` OpenCode row, architecture index one-liner, and compile reference/`US-05` notes to include OpenCode in the `AGENTS.md` family (last-writer-wins with Cursor/Codex).

## Risks / Trade-offs

- [Last-writer collision] → Document prefer a single active compile target; no merge — same policy as Cursor↔Codex.
- [Duplicated AGENTS.md renderer] → Accept short-term duplication; extract later if a fourth host joins the family.
- [Silent instruction skip → diagnostic] → Slightly noisier install reports; improves inspectability; keep non-fatal.

## Migration Plan

- No lockfile/schema migration. Existing projects gain `compile` when they upgrade `@b-apm/integration-opencode`.
- Rollback: omit `compile` / revert package version; materialize/MCP unchanged.
