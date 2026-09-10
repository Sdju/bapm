# Agent Plugins

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Portable Agent Plugins v1 boundary.

The public module API loads and discovers validated portable roots, and exposes
`createAgentPluginManifest` / `writeAgentPluginManifest` for producers. The
writer always emits canonical `plugin.json` and deliberately does not reuse the
APM-shaped manifest writer or create `bapm.yml`.

Declared `commands` / `hooks` path lists in `plugin.json` are requirements:
`discoverAgentPluginDeclaredPaths` resolves them under the plugin root and
fail-closes on missing or escaping paths before install deploy/lock commit.

Optional top-level `skills` is exclusive when present:

- omit → conventional immediate `skills/<name>/SKILL.md` discovery;
- `[]` → zero skills (shadow diagnostic if conventional entries exist);
- non-empty → only resolved names / `skills/<name>` / `skills` container;
  unknown, missing, traversal, or escape → `AGENT_PLUGIN_SKILL_DECLARED_INVALID`.

Consumer dep object-form `skills:` subset remains a separate layer (empty list is
still a manifest parse error there).
