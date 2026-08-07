# Agent Plugins

Portable Agent Plugins v1 boundary.

The public module API loads and discovers validated portable roots, and exposes
`createAgentPluginManifest` / `writeAgentPluginManifest` for producers. The
writer always emits canonical `plugin.json` and deliberately does not reuse the
APM-shaped manifest writer or create `bapm.yml`.
