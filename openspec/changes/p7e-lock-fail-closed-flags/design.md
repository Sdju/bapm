## Context

See proposal.md — Why. Baseline: `packages/cli/src/modules/Lock/services/runLock.ts` `parseLockArgs` soft-ignores unknown `-…` (comment ~L117); `runLock` returns `{ message }` on parse error without `console.error`. `parseExportArgs` already fail-closes unknown flags and unexpected positionals with stderr. Install pattern: `runInstall.ts` returns `Unknown install flag: ${arg}` on `arg.startsWith("-")`. Criteria: `.samples/apm-knowledge/topics/p7e-lock-fail-closed-flags-criteria.md`. APM Click rejects undeclared options by default; bapm keeps `--policy` on lock (P6c) even though APM lock docs omit it.

## Goals / Non-Goals

**Goals:**
- Fail-closed bare-lock argv for unknown flags before resolve/write.
- Mirror install wording + export positional fail-closed + stderr for parse errors.
- Preserve P6c known surface and export fail-closed.

**Non-Goals (design-level):**
- No new CLI framework / Click port; no core resolve API changes; no CONFORMANCE edits; no implementation of `--global`/`--target`.

## Decisions

### D1 — Fail-closed in `parseLockArgs` (mirror install / export)

**Choice:** After known-flag branches, if `arg.startsWith("-")` return `error: \`Unknown lock flag: ${arg}\``; else return `error: \`Unexpected lock argument: ${arg}\``. Remove the soft-ignore fallthrough.

**Rationale:** Same local parser as today; minimal blast radius; matches install and `parseExportArgs`.

**Alternative:** Shared argv helper across commands — deferred; overkill for one-file fix.

### D2 — Stderr on bare-lock parse errors

**Choice:** In `runLock`, on `parsed.error` call `console.error(parsed.error)` before returning non-zero (same as export path).

**Rationale:** Criteria S2; today bare-lock errors may only set `message` and rely on outer CLI — install/export already print. Prefer explicit stderr here for UX parity.

**Alternative:** Rely solely on command wrapper — rejected if thin path can omit print.

### D3 — Reject APM `--global`/`--target` as unknown

**Choice:** Do not add allowlist entries for `-g`/`--global`/`-t`/`--target`; they hit D1 unknown-flag path.

**Rationale:** Cursor/project freeze; criteria MUST NOT implement. Click parity is fail-closed, not feature parity for those options.

### D4 — Prefer fail before resolve/write

**Choice:** Keep existing control flow: parse → help → error return → only then `deps.resolveAndLock`. No structural change beyond ensuring error path never reaches resolve.

**Rationale:** Already the shape; acceptance should assert no write (mtime/bytes) when unknown flag on a fixture that would otherwise lock.

### D5 — Help text

**Choice:** Leave `formatLockHelp` known-options list unchanged; do not document `--global`/`--target`.

**Rationale:** Criteria MUST 5; advertising unimplemented flags would be untruthful.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Scripts that relied on soft-ignore of typos | Intentional **BREAKING** argv; document in proposal |
| `-t`/`-g` users expecting APM behavior | Clear unknown-flag error; do not implement |
| Double-print if outer CLI also logs `message` | Match export (already prints); accept if wrapper also surfaces message, or gate once if tests show duplication |
| Positional fail-closed surprises | SHOULD but cheap; align with export |

## Migration Plan

None for lockfiles. Callers must stop passing unrecognized bare-lock flags/positionals. Rollback = restore soft-ignore (not desired).

## Open Questions

- None blocking — S1/S2 included in this change as default per criteria.
