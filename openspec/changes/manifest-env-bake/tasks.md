## 1. Manifest env field

- [ ] 1.1 Add `env?: Record<string, string>` to `BapmManifest`; validate top-level `env` in parse (mapping, env-safe keys, string values)
- [ ] 1.2 Unit tests for accept/reject of `env`

## 2. Bake lookup + install wire

- [ ] 2.1 Extend bake options with manifest/defaults map; lookup order overrides → process.env → manifest.env
- [ ] 2.2 Pass `manifest.env` from install into `bakeMcpServerMaps`; unit/integration tests for fill-gap and process-wins
- [ ] 2.3 Cursor install test: manifest `env` satisfies `{bake:…}` when process env unset

## 3. Docs and verify

- [ ] 3.1 Document top-level `env:` in `config-manifest.md` (extension, precedence, no-secrets-in-git guidance)
- [ ] 3.2 Run focused manifest + mcp bake + install tests; mark tasks done
