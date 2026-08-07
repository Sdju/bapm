## Why

The `bapm-target-*` vocabulary now conflates two independently useful concerns: runtime integration with an agent host and producer-side host marketplace artifacts. A clean break is safe because there are no external users, and it prevents future host integrations from reintroducing host layout knowledge into core.

## What Changes

- **BREAKING** Rename `bapm-integration-api` and every concrete `bapm-target-*` workspace package to the `bapm-integration-*` namespace, with no compatibility packages, aliases, re-export shims, or legacy imports.
- Define an integration package as the owner of both host runtime capabilities (detect, deploy, MCP, compile) and host marketplace-output capabilities; keep `@bapm/core` neutral and capability-driven.
- Move the existing Cursor implementation and composition-root wiring to the integration namespace while preserving generic registration and injection.
- Make Claude and Codex marketplace output ownership explicit: define whether they become dedicated integration packages or remain separately capability-provided, and remove core-owned host-specific output mapping accordingly.
- Replace legacy terminology throughout workspace manifests, lockfiles, source, tests, documentation, and OpenSpec specifications; enforce an exhaustive absence check for `bapm-target-` and old package identifiers.
- Sequence the migration into independently verifiable phases so that package/API rename, Cursor runtime migration, marketplace-output migration, and legacy eradication do not leave mixed namespaces.

## Capabilities

### New Capabilities

- `integration-package-architecture`: Defines package ownership, generic integration capabilities, migration phases, and the no-legacy-compatibility policy.

### Modified Capabilities

- `target-api-contracts`: Replaces the target API boundary with a neutral integration API while retaining generic core-to-host capability contracts.
- `target-package-architecture`: Replaces target-package naming and ownership requirements with integration-package requirements.
- `target-cursor-minimal`: Moves Cursor runtime behavior and package identity to the integration namespace.
- `cursor-mcp-deploy`: Assigns Cursor MCP deployment to the Cursor integration.
- `marketplace-pack-outputs`: Moves Claude and Codex host output mapping and emission ownership out of core into the chosen integration-package design.

## Impact

Affected systems include pnpm workspace package manifests and lockfile, TypeScript imports and public exports, CLI composition roots, core capability contracts and tests, Cursor deploy/MCP/compile behavior, producer marketplace output implementation, documentation, OpenSpec specs, and generated compatibility/conformance assertions. The change intentionally makes old package names unavailable at source and package-resolution boundaries.
