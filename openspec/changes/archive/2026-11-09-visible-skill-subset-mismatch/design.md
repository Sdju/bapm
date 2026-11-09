## Context

See proposal.md for motivation. `applySkillSubsets` already emits `EMPTY_SKILL_SUBSET` when `kept.length === 0`, and install puts that object on `result.diagnostics`. Two gaps keep it invisible:

1. The CLI warning emitter only prints diagnostics with `warn: true` or codes matching `_UNSUPPORTED` / `MCP_DIR_` / `_SKIP_`. `EMPTY_SKILL_SUBSET` matches none of those, so stderr stays empty even with `-v`.
2. The same loop `continue`s when at least one skill matched, so leftover unknown names never produce a diagnostic.

req-mf-022 is warn-not-fail. Plugin.json exclusive `skills:` remains a separate fail-closed path.

## Goals / Non-Goals

**Goals:**

- Diagnose every requested subset name that matches no available skill of that dependency.
- Make those diagnostics default-visible on CLI stderr (`bapm: warning:`).
- Keep install `ok` when that is the only problem.

**Non-Goals:**

- Lock `skills_requested` / audit drift (original subset slice deferred this; still deferred).
- Fail-closed consumer subsets or a new CLI flag.

## Decisions

### One filter, two codes

**Choice:** Keep `EMPTY_SKILL_SUBSET` when zero requested names match. Emit `SKILL_SUBSET_UNMATCHED` when some names match and others do not. Both objects set `warn: true` and list `requested`, `unmatched`, and `available`.

**Why:** Existing core tests and Mode B citations look for the empty-match diagnostic; a new code for the partial case keeps that citation stable. Unmatched names are computed per requested item against `skillMatchesSubset`, so path aliases still count as a hit.

**Alternatives:** One code for both — rejected because it would churn req-mf-022 citations. Fail-closed — rejected by req-mf-022.

### CLI visibility via `warn: true` plus code fallback

**Choice:** Set `warn: true` on the diagnostic at the source. Also teach the CLI emitter to treat codes containing `SKILL_SUBSET` as warnings, matching the existing `warn === true` short-circuit.

**Why:** Other install warnings (lifecycle, LSP, canvas) already use `warn: true`. The code fallback covers a forgotten flag the same way `_UNSUPPORTED` does.

**Alternatives:** Print every diagnostic — too noisy (dry-run, policy internals). Only the whitelist without `warn: true` — easy to miss the next subset code.

## Risks / Trade-offs

- **[Authors with typos start seeing warnings on previously “successful” installs]** → intended; install still exits 0.
- **[Audit still cannot see subset drift after the fact]** → accepted; lock/audit remains a follow-up.

## Migration Plan

1. Tests for empty + partial subset at core and CLI.
2. Filter + CLI emitter.
3. Docs sentence on unknown `skills:` names.
4. Rollback = revert; manifests without unknown subset names are unchanged.

## Open Questions

_None._
