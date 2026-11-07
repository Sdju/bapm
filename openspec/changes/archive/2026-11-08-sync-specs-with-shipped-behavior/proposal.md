## Why

A docs-vs-spec audit found main specs that no longer describe what bapm does, contradict each other, or regulate documentation wording instead of behaviour. Contributors and agents working spec-first get wrong answers from them (for example, scenarios still use the rejected `active: [cursor]` form), and CLI help leaks internal requirement IDs (`rs-011`, `sc-010`, `M7`, `pr-004`, …) to users.

## What Changes

- Scenarios that use the rejected legacy `active: [id]` form are rewritten to the structured `active: { target: id }` form (behaviour unchanged).
- `manifest-local-overlay` precedence gains the MCP placeholder exception that `mcp-env-bake` already mandates (process env wins over manifest `env`).
- `install-pipeline` intersection requirement gets an explicit scenario for the user-visible consequence: a root `targets` map with one key leaves other active hosts with no files.
- `integration-agent-skills-runtime` activation no longer requires an object-map entry (canonical package resolution already registers it).
- Requirements that regulate documentation text are reduced to their behavioural core (`executable-mcp-trust` soft surface, `install-trust-bin` ladder).
- CLI help text: internal IDs removed; stale lines fixed (`compile` "(cursor)", `deps` missing `clean`, `--force` "future security gates", `init`/`plugin init --target` side effects, `publish` prerequisites, `audit -o`, `cache clean -y`, `doctor -v`).
- `CONFORMANCE.md` / checklist: `req-tg-002…010` rationale and the multi-target limitation no longer say "beyond cursor".

Non-goals (follow-up changes):

- Mechanical removal of milestone labels (M1–M10, P3, …) from requirement prose across all specs.
- Rewriting `compile-agents-md`, `cursor-mcp-deploy` and other heavily outdated specs end to end.
- Behaviour changes found by the audit: `init --target` writing a narrowing `targets:` map, dropped MCP `headers`, MCP written only for the first active agent, partial `uninstall`, no orphan-file cleanup, `origin` leaking into MCP configs.
- Test isolation from the user's `~/.bapm` and the 5 CLI tests that fail in the dev workspace because Cursor resolves without a project install.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `manifest-local-overlay`: precedence rule gains the MCP placeholder exception.
- `target-integration-dynamic-load`: structured `active` in scenarios.
- `integration-agent-skills-runtime`: activation via canonical package, structured `active`.
- `install-pipeline`: intersection scenarios use structured `active`; narrowing consequence made explicit.
- `cli-runtime-surface`: compile selection scenario uses structured `active`.
- `executable-mcp-trust`: soft-surface requirement states behaviour, not documentation wording.
- `install-trust-bin`: ladder requirement drops the documentation clause.

## Impact

- Specs only for the capability deltas; no runtime behaviour change.
- `packages/cli/src/modules/*/services/*` help strings (already edited in the working tree).
- `tests/spec-conformance/checklist.yml`, `scripts/gen-conformance-statement.mjs`, regenerated `CONFORMANCE.md` / `CONFORMANCE.json`.
