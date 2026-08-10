## Context

See proposal.md — Why. Today only `@b-apm/integration-cursor` is a full runtime host; Claude/Codex are marketplace-output only. Canonical token `opencode` is already valid in `Manifest/targets.ts`. OpenCode (v1.x docs matching the local `opencode` CLI) discovers skills from `.opencode/skills`, agents from `.opencode/agents`, and MCP from project `opencode.json` under top-level `mcp` with `type: "local" | "remote"`. Dynamic load via object-map `targets:` is already implemented (`target-integration-dynamic-load`); `bapm init --target <id>` already writes `@b-apm/integration-<id>`.

## Goals / Non-Goals

**Goals:**

- Mirror Cursor’s package shape so apply can clone patterns (`create*Integration`, deployRoots, configureMcp merge, portable skill copy).
- Make `bapm install --target opencode` + running `opencode` in the project pick up deployed skills/agents/MCP without manual copy.
- Extend Agent Plugins compatibility docs/matrix expectations for OpenCode adapter behavior.

**Non-Goals:**

- Writing global `~/.config/opencode/**` (project-scoped only).
- Installing OpenCode JS plugins via `plugin` / `opencode plugin`.
- Supporting OpenCode V2-only `mcp.servers` nesting unless/until product docs for the shipped CLI require it.
- Instruction/rules parity (no Cursor-style `.mdc` rules mapping in v1).
- Eager CLI registration of opencode.

## Decisions

1. **Native `.opencode/` layout over `.agents/skills` compatibility path**  
   OpenCode also reads `.agents/skills`, but native `.opencode/skills` is the documented primary project source and avoids colliding with Cursor’s preferred tg-003 root when both hosts exist.  
   _Alternative considered:_ only `.agents/skills` — rejected because MCP still needs `opencode.json` and dual-host projects benefit from separate skill trees.

2. **MCP file = project `opencode.json`, merge under `mcp`**  
   Match current OpenCode docs (`type: local` + `command[]`, `type: remote` + `url`). Prefer `opencode.json` over `opencode.jsonc` for machine writes; if only `.jsonc` exists, create/update `opencode.json` (JSON) rather than rewriting comments-aware JSONC in v1.  
   _Alternative:_ separate `.opencode/mcp.json` — rejected; OpenCode does not load MCP from that path.

3. **SSE fail-closed**  
   OpenCode public MCP docs expose local/remote only; portable `sse` has no safe 1:1 mapping. Fail closed instead of inventing remote.  
   _Alternative:_ map sse → remote URL — rejected as unverified.

4. **Factory export**  
   Prefer `createIntegration` / `createOpencodeIntegration` named exports (CLI load already accepts `createIntegration` then `createCursorIntegration`-style, then default). Implement `createOpencodeIntegration` + re-export as `createIntegration` for consistency with Cursor.

5. **Registered deploy roots**  
   Default `[".opencode"]`. `opencode.json` lives at project root: either register `"."` as an additional root for MCP only, or treat `opencode.json` as a special allowed path under the same containment helper used carefully. Prefer registering both `.opencode` and `.` only if needed for assertUnderDeployRoots; otherwise document that configureMcp may register `opencode.json` as an explicit allowed relative path within containment. Closest Cursor pattern: Cursor keeps MCP under `.cursor/`; OpenCode cannot. Decision: `deployRoots` = `[".opencode", "."]` with MCP writes restricted to the single relative file `opencode.json` (never arbitrary paths under `.`).

6. **Docs + compatibility**  
   Update `supported-hosts` / `agent-plugins` and add OpenCode cases to compatibility fixtures/tests parallel to Cursor e2e in agent-plugins consumer coverage.

## Risks / Trade-offs

- [JSONC projects] → Mitigation: write `opencode.json`; document that JSONC-only projects may need a one-time JSON file; do not strip comments from JSONC in v1.
- [OpenCode schema drift V1 vs V2] → Mitigation: lock mapping to docs matching shipped CLI; keep adapter in one module for easy retarget.
- [Dual Cursor + OpenCode] → Mitigation: separate skill roots; users select via `--target` / `active`.
- [Root `.` in deployRoots broadens write surface] → Mitigation: MCP writer hard-codes `opencode.json` basename only; materialize never writes outside `.opencode/`.

## Migration Plan

1. Land package + unit tests; no default manifest change in this repo.
2. Users: `npm i -D @b-apm/integration-opencode`, set `targets.opencode`, `bapm install --target opencode`, run `opencode`.
3. Rollback: remove map entry / uninstall package; delete generated `.opencode/**` and owned `mcp` keys manually if desired.

## Open Questions

None blocking; V2 `mcp.servers` nesting deferred until CLI/docs for this environment require it.
