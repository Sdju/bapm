## 1. Active specification and documentation cleanup

- [x] 1.1 Move active `target-api-contracts` and `target-cursor-minimal` specifications to the canonical `integration-api-contracts` and `integration-cursor-runtime` slugs, preserving their requirements.
- [x] 1.2 Consolidate enduring active architecture requirements in `integration-package-architecture` and remove only the active obsolete `target-package-architecture` specification.
- [x] 1.3 Update live README, documentation, and active-spec references to canonical slugs; verify no active reference points to any superseded slug.
- [x] 1.4 Preserve all `openspec/changes/archive/**` content and existing negative legacy-package rejection assertions unchanged.

## 2. Breaking public vocabulary rename

- [x] 2.1 Rename public integration API types and registry factory to `BapmIntegration`, `IntegrationRegistry`, and `createIntegrationRegistry`; remove target-era exports and registry aliases.
- [x] 2.2 Update core, CLI composition helpers, concrete integrations, test fixtures, and public package documentation to use integration-neutral registry vocabulary and labels.
- [x] 2.3 Retain the OpenAPM manifest target semantics and `--target <id>` CLI selector while routing selection through the renamed integration registry.

## 3. Behavioural acceptance (RED)

- [x] 3.1 Add consumer-level acceptance coverage that imports and uses only the renamed public API to register and select an integration.
- [x] 3.2 Add behavioural coverage that a retired public API import fails and that retired `bapm-target-*` package resolution remains rejected.
- [x] 3.3 Add install/compile coverage proving `--target <id>` continues to select a registered integration.
- [x] 3.4 Keep acceptance tests free of source-text, source-tree, AST, or implementation-export analysis; test only module-resolution and runtime/CLI behaviour.

## 4. Verification

- [x] 4.1 Run the behavioural acceptance suite and affected integration API, core, CLI, and Cursor package tests/checks.
- [x] 4.2 Run strict OpenSpec validation for `integration-vocabulary-cleanup`.
- [x] 4.3 Perform and record a scoped active-doc/spec reference review confirming no superseded slug remains outside historical archives.
