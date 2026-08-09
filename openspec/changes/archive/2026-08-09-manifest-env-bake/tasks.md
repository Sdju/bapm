## 1. Manifest env field

- [x] 1.1 Validate top-level `env` in parse (mapping, env-safe keys `[A-Za-z_][A-Za-z0-9_]*`, string values); keep existing `BapmManifest.env?` type — do not re-add
- [x] 1.2 Unit tests for accept/reject of `env` (and confirm overlay merge still re-validates effective `env`)

## 2. Bake lookup + install wire

- [x] 2.1 Extend bake options with `manifestEnv` (or defaults); lookup order overrides → process.env → manifest.env
- [x] 2.2 Pass effective `document.env` from install into `bakeMcpServerMaps`; unit/integration tests for fill-gap and process-wins
- [x] 2.3 Cursor install test: manifest `env` satisfies `{bake:…}` when process env unset

## 3. Docs and verify

- [x] 3.1 Document top-level `env:` in `config-manifest.md` (extension, precedence, no-secrets-in-git guidance; distinguish from per-server MCP `env` and overlay)
- [x] 3.2 Run focused manifest + mcp bake + install tests; mark tasks done
