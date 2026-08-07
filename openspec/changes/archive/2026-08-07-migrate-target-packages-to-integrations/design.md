## Context

See `proposal.md` for motivation. The current package boundary is `packages/integration-api` and `packages/integration-cursor`; core and the CLI import their legacy package specifiers, while core also owns the Claude/Codex marketplace mappers. Live specs, documentation, tests, package manifests, and the lockfile retain the same terminology.

## Goals / Non-Goals

**Goals:**

- Make `bapm-integration-api` the sole generic capability boundary for core.
- Make `bapm-integration-cursor` own existing Cursor runtime behavior.
- Move each marketplace host format into an explicit integration package.
- Complete a clean namespace break with mechanical proof that the retired names are absent.

**Non-Goals:**

- Preserve external compatibility for retired package names.
- Add Claude or Codex runtime deployment support merely because their marketplace integrations exist.
- Change observable Cursor deployment, MCP, or compile semantics other than package identity.
- Redesign resolver, lockfile, or marketplace authoring inputs.

## Decisions

### D1 — Physical package move and package-name break

Move `packages/integration-api` to `packages/integration-api` and `packages/integration-cursor` to `packages/integration-cursor`; rename their npm identities to `bapm-integration-api` and `bapm-integration-cursor`. Update every workspace dependency, import, test, fixture, generated lockfile entry, and CLI composition root in the same phase.

No workspace alias, `exports` alias, re-export package, tsconfig/vite alias, dynamic fallback, or legacy adapter is allowed. There are no users to migrate, so a hard failure for an old specifier is more reliable than temporarily supporting both names.

Alternative rejected: a dual-publish transition leaves a mixed package graph and makes the requested absence criterion unprovable.

### D2 — Capability names are generic, integration ownership is host-specific

The renamed API preserves the registry/injection model and exposes optional generic capabilities: runtime detect/materialize/MCP/compile and marketplace-output emission. Core selects capabilities from registered integrations and coordinates generic resolution, validation, atomic persistence, and reporting; it does not contain a host-id switch or host document mapper.

Alternative rejected: keep marketplace outputs as core modules. That would leave host document shape and default paths in core, contradicting the integration boundary.

### D3 — Dedicated marketplace-only Claude and Codex integrations

Create `packages/integration-claude` (`bapm-integration-claude`) and `packages/integration-codex` (`bapm-integration-codex`). They implement only marketplace-output capability at this stage. Claude owns the `.claude-plugin/marketplace.json` shape and default, and Codex owns `.agents/plugins/marketplace.json`, category validation, and its document shape. The CLI composition root registers them for pack; no runtime target activation is involved.

Alternative rejected: combine them with Cursor because marketplace outputs are independent of Cursor runtime support. Alternative rejected: expose mapper functions from core because it preserves host-specific core ownership.

### D4 — One orchestrated change, four ordered implementation phases

1. Rename API package and generic contract vocabulary, update core/CLI imports, package graph, and generic registry tests.
2. Move Cursor code/tests/docs to the integration package and prove existing runtime deploy/MCP/compile behavior through the renamed API.
3. Extract Claude/Codex mapping and host validation to their marketplace-only integration packages; register them for pack and remove core mapper exports.
4. Remove retired package compatibility surfaces and stale user-facing terminology; add public package-graph assertions instead of repository source audits.

Phases are not independently shippable because aliases are forbidden. Their checkpoints instead reduce review and diagnosis scope; the workspace must remain internally consistent after every commit.

### D5 — Public package-graph proof

Acceptance and final validation prove the public package graph: required `bapm-integration-*` packages resolve to their declared identities, core exposes only the generic integration API dependency, and retired `bapm-target-*` specifiers fail resolution. No legacy package, resolver alias, re-export shim, or compatibility adapter may be added. This behavioral invariant deliberately permits necessary live references to the new integration package names and does not require acceptance tests to inspect repository source text.

## Risks / Trade-offs

- [Lockfile churn obscures package moves] → regenerate only through the workspace package manager after manifest changes and review the package-name diff.
- [A legacy resolver path survives the rename] → use negative package-resolution plus targeted package-graph assertions.
- [Extracted marketplace mappers change output] → characterize existing Claude/Codex output, path jail, atomicity, and Codex category failure before extraction.
- [Capability API becomes a host catalog] → accept only generic capability-shaped contracts; do not add Claude/Codex fields to core APIs.
- [Historical OpenSpec records retain retired names] → preserve immutable archive history; acceptance remains independent of repository-text scans.

## Migration Plan

1. Add failing behavioral acceptance suites for each phase, including negative package-resolution checks.
2. Apply phases D4.1–D4.4 sequentially, keeping generic behavior and package graph green after each.
3. Run workspace build, type/lint checks, targeted runtime and marketplace suites, and the public package-graph acceptance checks.
4. Archive/sync the OpenSpec change only after live specs use integration terminology.

Rollback consists of reverting the migration commits as a unit. Because no aliases or users exist, partial rollback is not supported and no persistent data migration is required.
