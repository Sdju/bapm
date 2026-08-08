## 1. Package scaffold

- [ ] 1.1 Create `packages/integration-opencode` (package.json, tsconfig, vite config, exports) mirroring `@bapm/integration-cursor`, depending only on `@bapm/integration-api`
- [ ] 1.2 Export `createOpencodeIntegration` / `createIntegration` from package entry; `vp pack` / `vp check` succeed

## 2. Runtime detect and materialize

- [ ] 2.1 Implement `detect` for `.opencode/` directory and `opencode.json` / `opencode.jsonc` at project root
- [ ] 2.2 Implement skill materialize to `.opencode/skills/<name>/SKILL.md` including portable Agent Plugins directory copy with containment
- [ ] 2.3 Implement agent materialize to `.opencode/agents/<name>.md`; skip instruction/MCP side effects in materialize
- [ ] 2.4 Register default deployRoots `.opencode` and `.` per design; assert writes never escape roots

## 3. MCP configure

- [ ] 3.1 Implement `configureMcp` merge into project `opencode.json` `mcp` (preserve unrelated keys/servers)
- [ ] 3.2 Map stdio → `type: "local"` + `command` array; streamable-http/http → `type: "remote"` + `url`/`headers`
- [ ] 3.3 Fail closed for portable `sse` (and any undocumented transport) without inventing entries
- [ ] 3.4 Return ConfigureMcpReport paths suitable for lock inventory

## 4. Tests and Agent Plugins compatibility

- [ ] 4.1 Unit tests for detect, skills/agents materialize, MCP merge/mapping, SSE fail-closed, root containment
- [ ] 4.2 Extend Agent Plugins regression (or dedicated e2e) so packed portable plugin installs into OpenCode (skills under `.opencode/skills/`, MCP under `opencode.json`)
- [ ] 4.3 Update `tests/agent-plugins/compatibility-cases.json` / regenerated compatibility artifact and ensure `agent-plugins:check` passes

## 5. Docs and verify

- [ ] 5.1 Document OpenCode on `supported-hosts`, `agent-plugins`, and architecture index (opt-in `@bapm/integration-opencode` + `targets:`)
- [ ] 5.2 Run package/workspace checks (`vp check` / targeted tests) for the new package and updated compatibility suite
