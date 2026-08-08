## 1. Package scaffold

- [x] 1.1 Create `packages/integration-agent-skills` (package.json workspace dep on `@bapm/integration-api` only, vite.config.ts, tsconfig, README) matching other integration-* scaffolding; ensure workspace discovery
- [x] 1.2 Export `createAgentSkillsIntegration` + `createIntegration` alias from `src/index.ts` with `id: "agent-skills"` and `deployRoots: [".agents"]`; omit `configureMcp` and `compile`

## 2. Detect and materialize

- [x] 2.1 Implement `detect` that always returns false and never creates `.agents/`
- [x] 2.2 Materialize skills → `.agents/skills/<name>/SKILL.md` via `materializeSkill` (portable Agent Plugins full directory copy); assert under deploy roots; fail closed on escapes
- [x] 2.3 Skip non-skill primitives (instruction, agent, command, prompt, hook, unknown) with non-fatal diagnostics; write no host files for them

## 3. Tests and docs

- [x] 3.1 Unit tests: never-detect (with and without `.agents/`), skill materialize + portable copy, non-skill skips + diagnostics, no MCP/compile on factory result
- [x] 3.2 Acceptance suite under `packages/integration-agent-skills/tests/acceptance/integration-agent-skills-runtime/` covering package boundary, never-detect, skills-only materialize, explicit activation path
- [x] 3.3 Update docs (`supported-hosts` and related object-map notes) for agent-skills explicit-only load via `targets: { agent-skills: "@bapm/integration-agent-skills" }`
- [x] 3.4 Run package/workspace checks (`vp check` / targeted tests) for `@bapm/integration-agent-skills`
