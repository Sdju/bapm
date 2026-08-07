## Why

The package migration has made `@bapm/integration-*` the canonical boundary, but active specifications, live documentation, and the public integration API still use target-era vocabulary. Leaving both vocabularies active makes the supported API unclear and risks recreating compatibility paths that the migration intentionally rejects.

## What Changes

- Remove the obsolete active `target-package-architecture` specification after preserving its canonical integration-boundary requirements in `integration-package-architecture`.
- Rename the active `target-api-contracts` and `target-cursor-minimal` specification slugs to integration-neutral names, and update every live documentation/specification reference to the replacement slugs.
- **BREAKING** Rename public integration API vocabulary from `BapmTarget`, `TargetRegistry`, and `createTargetRegistry` to integration-neutral names; remove old API aliases and update CLI composition/labels accordingly.
- Retain OpenAPM domain terms in the manifest and the `--target` CLI option, retain historical OpenSpec archives, and preserve negative assertions that reject legacy `bapm-target-*` compatibility.
- Add behavioural acceptance coverage only; it must prove the renamed public API and unaffected domain behavior without source-text or source-tree analysis.

## Capabilities

### New Capabilities
- `integration-api-contracts`: Defines the integration-neutral public registration API and the absence of legacy API aliases.
- `integration-cursor-runtime`: Defines the renamed active Cursor integration specification without changing its observable runtime behavior.
- `integration-vocabulary-hygiene`: Defines active-spec/document reference hygiene while preserving historical archives and OpenAPM target-domain terminology.

### Modified Capabilities
- `integration-package-architecture`: Makes the canonical architecture specification the sole active architecture contract and preserves rejection of retired target packages.
- `install-pipeline`: Describes registry-facing install behavior using integration-neutral API vocabulary while retaining the manifest and `--target` domain interface.
- `compile-agents-md`: Describes registry-facing compile behavior using integration-neutral API vocabulary while retaining the `--target` domain interface.

## Impact

Affected areas include `@bapm/integration-api` exports and consumers in core, CLI, concrete integrations, tests, active OpenSpec specifications, and live README/docs references. Historical OpenSpec archives and their legacy vocabulary are explicitly out of scope for deletion or rewriting.
