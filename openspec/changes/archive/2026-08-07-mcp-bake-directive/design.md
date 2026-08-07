## Context

See `proposal.md`. Bake already runs in install via `bakeMcpServerMaps` (`packages/core/src/modules/Mcp/bake.ts`) with APM regexes. Authors asked for an explicit bapm marker `{bake:…}` that APM does not define.

## Goals / Non-Goals

**Goals:**

- Extend bake regex/parser to recognize `{bake:NAME}` and `{bake:env:NAME}` in the same pass as existing placeholders.
- Same lookup + fail-closed path; docs mark it as bapm extension.
- Unit + (if cheap) install regression covering the directive.

**Non-Goals:**

- Changing default Cursor behavior of APM `${VAR}` (still bake).
- Nested `{bake:${VAR}}`; runtime translate hosts; CLI new flags.

## Decisions

1. **Syntax `{bake:NAME}` / `{bake:env:NAME}`** — single braces, prefix `bake:` (optional `env:`), identifier only.  
   - **Why:** Matches user request `{bake:*}`; distinct from APM `${…}` and from APM-internal `{name}` templates (those are not `bake:`).  
   - **Alt:** `{bake:${VAR}}` — rejected (harder parse, redundant with NAME lookup).

2. **Same bake pipeline, one regex extension** — do not add a second install hook.  
   - **Alt:** Separate “only bake directives, leave APM forms” mode — deferred; would be **BREAKING** vs current Cursor APM parity.

3. **Forward-compat note in docs** — `{bake:}` means “must bake here”; APM forms remain OpenAPM/APM compatibility on Cursor. Future runtime hosts MAY leave `${VAR}` while still honoring `{bake:}` — not implemented in this change.

## Risks / Trade-offs

- **[Risk] Collision with unrelated `{bake:…}` prose in values** → Mitigation: strict identifier after `bake:` / `bake:env:`; odd strings without match pass through.
- **[Risk] Confusion with APM `{name}` package templates** → Mitigation: docs: only `bake:` prefix is the directive; single-brace without `bake:` is not this feature.

## Migration Plan

- Additive only; no lock/manifest migration.
- Docs + tests; archive sync into `mcp-env-bake`.

## Open Questions

- None blocking — CLI override flag remains deferred from prior change.
