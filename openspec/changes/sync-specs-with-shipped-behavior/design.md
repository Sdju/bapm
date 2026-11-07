## Context

The user docs in `apps/docs` were rewritten against the actual CLI behaviour. The same audit compared them with `openspec/specs` and found three kinds of drift:

1. **Stale examples.** Scenarios in `target-integration-dynamic-load`, `integration-agent-skills-runtime`, `install-pipeline` and `cli-runtime-surface` use `active: [id]`, which `manifest-yaml-validate` and `manifest-presets` require to be rejected.
2. **Contradictions.** `manifest-local-overlay` says env overrides have the lowest precedence, while `mcp-env-bake` requires process env to win for MCP placeholders.
3. **Requirements about wording.** `executable-mcp-trust` and `install-trust-bin` constrain what "documentation" must say, which is neither testable against code nor stable as docs change.

User-facing help also printed internal requirement IDs and milestone labels.

## Goals / Non-Goals

**Goals:** make the touched requirements self-consistent and behavioural, without changing runtime behaviour; remove internal IDs from help; keep CONFORMANCE honest about host layouts.

**Non-Goals:** the behaviour changes and wide mechanical cleanups listed in the proposal.

## Decisions

- **Rewrite scenarios, keep requirement titles.** Titles are the merge keys for `MODIFIED`; keeping them avoids churn in archived changes that reference them.
- **Make root-target narrowing explicit instead of changing it.** The intersection rule is intentional OpenAPM behaviour. The surprise comes from `init --target` writing a `targets:` map; changing `init` is a product decision and is deferred.
- **Replace doc-wording clauses with a behavioural rule plus a conformance-statement rule.** The only machine-checkable artefact is `CONFORMANCE.md`, which is generated from the checklist, so the "ungated hooks/canvas" honesty requirement is pinned there.
- **agent-skills activation via canonical package.** `packages/cli/src/common/canonicalHosts.ts` already lists `agent-skills`; the object-map entry is optional.

## Risks / Trade-offs

- [Other specs still contain `active: [id]` in prose or milestone labels] → tracked as a follow-up; `rg -n "active: \[" openspec/specs` lists them.
- [Tests that grep help for requirement IDs] → CLI suite was re-run after the help edits; only the 5 workspace-environment failures remain, and they fail identically on the base revision.
