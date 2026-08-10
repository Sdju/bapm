## 1. Helpers + tests

- [x] 1.1 Add `writeDeployedFile`, `renderPrimitivesMarkdown`, `compileMarkdownReport`, `filterFrontmatterKeys`, and `SHARED_COMMAND_FRONTMATTER_KEYS` in `packages/integration-api/src/helpers.ts`; export from `index.ts`
- [x] 1.2 Add unit tests in `packages/integration-api/tests/` covering write/refuse, render sort/filter/empty, compile preview/write/basename/escape, frontmatter drop/no-fence
- [x] 1.3 Update `packages/integration-api/README.md` helper table

## 2. Migrate compile hosts

- [x] 2.1 cursor, opencode, grok-build, codex → shared render + compileMarkdownReport
- [x] 2.2 kiro, antigravity, copilot → shared helpers with instruction filters / custom titles
- [x] 2.3 gemini → shared helpers with instruction-only filter, custom sectionHeading, requireBasename `GEMINI.md`

## 3. Migrate frontmatter + deploy writes

- [x] 3.1 cursor, claude, grok-build → `filterFrontmatterKeys` (+ shared constant)
- [x] 3.2 Replace pure assert+mkdir+write+push DeployedFile loops with `writeDeployedFile` in hosts that match the pattern (at least cursor/claude/grok/windsurf/copilot instruction/agent paths; commands after filter)

## 4. Verify

- [x] 4.1 `vp run --filter @b-apm/integration-api test` and build affected integration packages / relevant host tests
- [x] 4.2 Mark tasks complete; note residual host-local wrappers if any

### Residual host-local wrappers (intentional)

- claude: `transformClaudeRulesMarkdown` (`applyTo` → `paths`)
- codex: agent → TOML transform
- gemini: command → TOML transform
- kiro: steering / agent YAML transforms
- antigravity: rules transform
- hooks / MCP / ownership sidecars / `copyHookScript` — deferred to P1/P2
