## Why

APM 0.29.0 makes plugin-manifest `skills:` **exclusive**: a present key replaces conventional `skills/` discovery, and `"skills": []` means deploy **zero** skills (not “all”). Today bapm’s Agent Plugins loader treats top-level `skills` as an unknown field (warning) and always discovers immediate `skills/<name>/SKILL.md`, so authors cannot opt out of discovery or pin an explicit skill set. This slice brings that BREAKING parity into the portable install/discover path.

## What Changes

- **BREAKING:** Parse and retain optional `plugin.json` `skills` (array of strings). Presence of the key is authoritative for which skills are discoverable/deployable from that plugin root.
- **BREAKING:** `"skills": []` deploys **no** skills even when `skills/` exists; emit a clear diagnostic when the empty list shadows conventional entries (declare skills/container or omit the key to restore discovery).
- Omit `skills` → keep today’s conventional discovery at expected depth (`skills/<name>/SKILL.md` only; nested deeper dirs are not skills).
- Non-empty declared list → deploy only resolved entries (skill names and/or conventional container/path forms at expected depth); **fail-closed** when a declared name/path is missing, unknown, traversal, or escapes the plugin root (before deploy/lock commit).
- Docs + changelog note the breaking omit-vs-`[]` semantics; distinguish from consumer-side dep `skills:` (deps-object-subset: empty list remains a parse error there).

### Non-goals (this change)

- `--trust-bin` / ExecutableTrust (shipped).
- Copilot-native Agent Plugins registration / `pack --format agent-plugin`.
- `pack --check-versions` + plugin.json-only pack.
- OpenAPM req-pl-018; policy canonical identity casing.
- Consumer dep object-form `skills:` / `targets:` subset (already shipped).
- `.bapmignore`; Hermes; Homebrew/`install.sh`; CLI `--skill` / `--skill '*'`.

### Follow-ups (not tasks of this change)

1. `copilot-native-agent-plugins`
2. `pack-check-versions-plugin-json`
3. `policy-canonical-identity-casing`

## Capabilities

### New Capabilities

- `plugin-skills-declaration`: Exclusive `plugin.json` `skills:` semantics (omit vs `[]` vs list), conventional-depth discovery when omitted, fail-closed resolution of declared names/paths/containers, and shadow diagnostic for empty lists.

### Modified Capabilities

- `agent-plugins-compatibility`: Portable boundary MUST treat declared `skills` like commands/hooks requirements when present; update compatibility narrative so exclusive declaration is in-boundary (not an ignored unknown field).
- `install-pipeline`: Install MUST consume exclusive discovery results (including zero-skill plugins) and fail closed on invalid declared skills before deploy/lock commit.

## Impact

- `@b-apm/core` `AgentPlugins` (`load`/`types`/`discover`, possibly `declaredPaths` or a skills resolver helper); Install portable primitive discovery (`discoverPortablePluginPrimitives`).
- Docs: `apps/docs/guide/agent-plugins.md` (and/or plugin reference); root changelog / release note for BREAKING omit-vs-`[]`.
- Tests in later orchestration phases (acceptance → promote); no new CLI flags or workspace packages.
- No FEOD CLI module changes expected beyond docs if CLI surfaces mention plugin skills.
