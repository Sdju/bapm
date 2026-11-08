# Lsp

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Collect and validate `dependencies.lsp` / `devDependencies.lsp` declarations and reconcile lock `lsp_*` inventory. Host packages own the native config paths and server shapes.

## Public API

- `parseLspDeclaration` / `parseLspDeclarations` — fail-closed parsing of `name`, `command`, `args`, `env`, `transport`, and `extensionToLanguage` (aliases `fileExtensions` / `extension_to_language`, `warmupTimeoutMs`)
- `collectLspServers` — root declarations plus dependency manifests (first declaration wins by server name)
- `applyLspInventoryToLock` — write `lsp_servers`, `lsp_configs`, `lsp_target_servers`, `lsp_config_provenance`
- `readLspTargetInventory` — read the previous target → server ownership map

## Fail-closed rules

- Entries must be objects with a non-empty `name`, a stdio `command`, and a non-empty extension language map.
- Bare string entries, `url`, non-`stdio` transports, duplicate names in one list, and malformed args/env fail before any host config write.
- Claude and Copilot are the only supported LSP hosts in this release.

## Lock shape

`lsp_servers` is a sorted name list, `lsp_configs` maps name → canonical server config, `lsp_target_servers` maps host id → sorted names, and `lsp_config_provenance` maps name → `project:.` or `package:<name>`.
