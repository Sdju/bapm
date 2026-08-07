# Portable Agent Plugins v1

bapm supports a deliberately narrow, portable Agent Plugins v1 boundary: root `plugin.json`, immediate `skills/<name>/SKILL.md` directories, and root `mcp.json`.

The generated [support matrix](../../../AGENT_PLUGINS_COMPATIBILITY.md) is backed by fixtures and regression tests. It is not an Agent Plugins certification and does not claim compatibility with every client.

## Cursor behavior

The Cursor integration adapts portable MCP entries to `.cursor/mcp.json`: `stdio` remains `stdio`, `streamable-http` becomes `http`, and `sse` remains `sse`. A portable MCP file is never copied verbatim as a Cursor configuration. Other hosts need their own explicit integration.

## Boundary

Portable plugins are distinct from bapm/OpenAPM manifests and from marketplace products:

- `plugin.json` is not `bapm.yml` or `apm.yml`;
- packing a portable plugin creates an archive, not a marketplace publication;
- the OpenAPM claims in [CONFORMANCE.md](../../../CONFORMANCE.md) do not assert Agent Plugins conformance.

Marketplace output integrations and portable plugin archives are supported independently of Cursor runtime materialization. They do not imply a client extension, marketplace publication, or runtime adapter for every host.

## Not supported

This surface does not implement sandboxing, OAuth or secret injection, hooks, agents, commands, client extensions, or vendor-specific extension behavior. Unsafe skill paths and reserved or secret-like MCP environment variables are rejected.
