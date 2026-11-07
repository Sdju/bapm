## 1. Spec deltas

- [x] 1.1 `manifest-local-overlay`: add MCP placeholder precedence exception and scenario
- [x] 1.2 `target-integration-dynamic-load`, `integration-agent-skills-runtime`, `install-pipeline`, `cli-runtime-surface`: structured `active` in scenarios
- [x] 1.3 `install-pipeline`: scenario for root `targets` narrowing other active hosts
- [x] 1.4 `executable-mcp-trust`, `install-trust-bin`: replace documentation-wording clauses with behaviour
- [x] 1.5 `openspec validate sync-specs-with-shipped-behavior --strict`

## 2. CLI help

- [x] 2.1 Remove internal requirement IDs and milestone labels from `--help` output (install, update, approve, deny, init, pack, publish, compile, cache, audit, doctor, plugin)
- [x] 2.2 Fix stale help lines: `compile` title, `deps clean`, `--force`, `init`/`plugin init --target` side effects, `publish` prerequisites and tokens, `audit -o`, `cache clean -y`, `doctor -v`, zip merge semantics
- [x] 2.3 Add a CLI test that no command's `--help` matches `/\b(req-)?[a-z]{2}-\d{3}\b|\bM\d+\b/` (`packages/cli/tests/runtime/help-no-internal-ids.test.ts`)

## 3. Conformance statement

- [x] 3.1 Checklist rationale for `req-tg-002…010` and the multi-target limitation no longer say "beyond cursor"
- [x] 3.2 Regenerate `CONFORMANCE.md` / `CONFORMANCE.json` (`pnpm run conformance:gen`)
- [x] 3.3 Commit and confirm `pnpm run conformance:check` and the honesty test pass (they compare with the committed statement)

## 4. Follow-ups (separate changes)

- [ ] 4.1 Replace remaining `active: [id]` prose and milestone labels across `openspec/specs`
- [ ] 4.2 Rewrite outdated `compile-agents-md` and `cursor-mcp-deploy` specs
- [ ] 4.3 Decide whether `init --target` should write only `active:` instead of a narrowing `targets:` map
