## Context

See proposal.md — Why. Hosts already share nearly identical local helpers for `.*/bapm-hooks.json` ownership and for copying hook scripts under a deploy root. Prior change `integration-api-shared-helpers` covered deploy/compile/frontmatter only and explicitly deferred this cluster.

Observed shapes today:

| Host                             | Sidecar fields          | Reinstall cleanup                                    |
| -------------------------------- | ----------------------- | ---------------------------------------------------- |
| cursor / claude / gemini / codex | `entries` + `scripts`   | strip owned commands only                            |
| windsurf                         | `entries` + `scripts`   | strip + rm scripts                                   |
| antigravity                      | `entries` + `scripts`   | rm scripts (+ deletes reserved container separately) |
| copilot                          | `hookFile` + `scripts`  | rm hook file + scripts                               |
| kiro                             | `hookFiles` + `scripts` | rm hook files + scripts                              |

Simple script copy (candidate resolve under hook dir / package root, skip when command already contains host needle, write `destRel`, return `./dest` or plain dest) is shared by cursor/claude/windsurf/gemini/codex/copilot. Kiro/antigravity use thicker rewrite (interpreter tokens / nested layout) — out of scope for shared copy.

## Goals / Non-Goals

**Goals:**

- One flexible `HookOwnershipSidecar` type plus read/write that tolerate missing optional fields.
- Shared strip-by-command and best-effort artifact removal so hosts compose only the steps they already use.
- Parameterized simple `copyHookScript` that hosts configure with needle + dest path (no host product names inside the helper).
- Migrate call sites without changing observable reinstall behavior (especially: no new script deletion on strip-only hosts).

**Non-Goals:**

- Full hooks materialize factory / event remap / MCP merge.
- Rewriting kiro/antigravity `copyHookScript` into the shared helper in this change.
- Changing sidecar on-disk schema keys (`owned`, `entries`, `scripts`, `hookFile`, `hookFiles`).

## Decisions

1. **Flexible owned record, not per-host types**  
   Export `HookOwnershipSidecar` with `owned: Record<string, { packageName?; entries?; scripts?; hookFile?; hookFiles? }>`. Hosts keep writing only the fields they need.  
   _Alternative considered:_ strict unions per layout — rejected; forces api to know host layouts.

2. **Compose strip vs remove; do not auto-chain**  
   `stripOwnedHookCommands(hooks, ownership)` mutates/filters a `hooks` object by owned `entries[].command`. `removeOwnedHookArtifacts(cwd, ownership)` best-effort `rm`s `scripts`, `hookFile`, and each `hookFiles` entry under `cwd`. Call sites choose which to invoke (cursor: strip only; windsurf: strip + remove; copilot: remove only).  
   _Alternative:_ one `prepareOwnedHooks` that always removes scripts — rejected; would change cursor/claude/gemini/codex behavior.

3. **Parameterized simple `copyHookScript`**  
   Signature roughly: `{ cwd, deployRoots, hookFile, command, alreadyDeployedNeedle, destRel, commandAsDotSlash?: boolean }` → `{ commandRel, scriptRel? }`. Behavior mirrors the six simple hosts: if `command` includes `alreadyDeployedNeedle`, normalize optional `./` and return; else resolve candidates from hook dir + `findPackageRoot(hookFile)`; missing source keeps original command; success uses `assertUnderDeployRoots` + `cpSync` and returns command relative path + `scriptRel`.  
   _Alternative:_ helper builds `destRel` from host prefix + hookName — rejected; keeps product paths in api.

4. **Placement**  
   Implement in `packages/integration-api/src/helpers.ts` (or a small adjacent module re-exported from `helpers` / package root) next to existing fs helpers; export from `index.ts`; document in README table.

5. **Migration order**  
   Unit tests in integration-api first; then merge hosts (cursor/claude/windsurf/gemini/codex) for sidecar + strip (+ remove only where present) + simple copy; then copilot/kiro/antigravity for ownership read/write/remove (copy stays local for thick hosts).

## Risks / Trade-offs

- [Silent behavior change via over-eager remove] → Mitigation: tasks and accept criteria explicitly forbid adding script/hook-file rm to strip-only hosts; migrations call helpers 1:1 with current steps.
- [Flexible sidecar hides typos] → Mitigation: unit tests cover malformed JSON → empty owned; hosts still validate deploy roots before write.
- [Kiro/agy copy left duplicated] → Accepted temporary duplication; follow-on can extract resolve-only if needed.

## Migration Plan

1. Land helpers + unit tests in `@b-apm/integration-api`.
2. Replace local duplicates in matching hosts; keep existing host hook tests green.
3. Rollback: revert host imports to local helpers or pin previous api package version; on-disk sidecars unchanged.

## Open Questions

- None that block specs/tasks; thick-copy extraction deferred.
