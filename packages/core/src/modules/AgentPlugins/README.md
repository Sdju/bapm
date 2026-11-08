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
`Pack` also applies the same requirements on the producer side: declared paths
(and every file in a declared skill directory) must be present in the collected
archive set, so a packed portable root cannot fail consumer validation later.

Optional top-level `skills` is exclusive when present:

- omit → conventional immediate `skills/<name>/SKILL.md` discovery;
- `[]` → zero skills (shadow diagnostic if conventional entries exist);
- non-empty → only resolved names / `skills/<name>` / `skills` container;
  unknown, missing, traversal, or escape → `AGENT_PLUGIN_SKILL_DECLARED_INVALID`.

Consumer dep object-form `skills:` subset remains a separate layer (empty list is
still a manifest parse error there).
