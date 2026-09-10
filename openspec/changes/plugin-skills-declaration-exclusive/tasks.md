## 1. Manifest parse + types

- [ ] 1.1 Add optional `skills?: string[]` to `AgentPluginManifest` / writer types; include `skills` in `TOP_LEVEL_FIELDS`
- [ ] 1.2 Validate present `skills` as array of non-empty strings (empty array allowed); reject non-array / non-string / empty-string; stop emitting `AGENT_PLUGIN_UNKNOWN_FIELD` for `skills`
- [ ] 1.3 Unit tests: omit / `[]` / list parse; malformed shapes fail closed; unknown other fields still warn

## 2. Exclusive discover

- [ ] 2.1 When `manifest.skills` is undefined, keep conventional immediate `skills/<name>/SKILL.md` discovery (expected depth only)
- [ ] 2.2 When `manifest.skills` is `[]`, return zero skills; if conventional scan would find ≥1 entry, emit shadow diagnostic (code + remediation message)
- [ ] 2.3 When non-empty, resolve names/paths/container (`skills` / `./skills` / `skills/<name>`) exclusively; fail closed on missing/unknown/traversal/escape; dedupe; do not add undeclared siblings
- [ ] 2.4 Unit tests covering omit vs `[]` vs list, container expand, nested-depth refusal, fail-closed unknown, shadow diagnostic

## 3. Install wiring

- [ ] 3.1 Ensure portable install primitive discovery consumes exclusive discover results (including zero-skill plugins)
- [ ] 3.2 Propagate declared-skill hard errors to install fail-closed before deploy/lock commit (parity with commands/hooks timing)
- [ ] 3.3 Confirm consumer dep `skillSubset` still filters after exclusive discover; dep `skills: []` remains parse error
- [ ] 3.4 Integration/install tests: declared subset deploy, empty list no materialize + diagnostic, invalid declaration aborts

## 4. Docs and changelog

- [ ] 4.1 Update `apps/docs/guide/agent-plugins.md` (and AgentPlugins README if needed) for omit / `[]` / list + fail-closed
- [ ] 4.2 Add BREAKING changelog/release note distinguishing plugin exclusive `skills:` from consumer dep subset
- [ ] 4.3 Refresh compatibility narrative/matrix text if it still implies skills are always directory-scanned only

## 5. Verification

- [ ] 5.1 Run targeted vitest for AgentPlugins load/discover and install exclusive-skills paths
- [ ] 5.2 Run `vp check` (or package-scoped check) and fix regressions introduced by this change
