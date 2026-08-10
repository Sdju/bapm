## 1. Characterize and guard the migration

- [x] 1.1 Add RED acceptance coverage for renamed API and Cursor package identities, successful generic registry injection, and rejection of legacy specifier resolution.
- [x] 1.2 Add RED acceptance coverage that characterizes current Cursor detect, materialize, MCP, compile, root-safety, and inventory-report behavior through the integration API.
- [x] 1.3 Add RED acceptance coverage for Claude and Codex output selection, unchanged default paths and JSON semantics, Codex category failure, path jail, and marketplace-only registration.
- [x] 1.4 Add RED behavioral package-graph coverage that proves required integration packages resolve, retired package specifiers do not resolve, and no compatibility alias is exposed.

## 2. Rename the generic boundary

- [x] 2.1 Move `packages/integration-api` to `packages/integration-api`, rename the package to `@b-apm/integration-api`, and rename public contract terminology only where it denotes the package boundary rather than a generic runtime concept.
- [x] 2.2 Update `@b-apm/core`, CLI, workspace manifests, lockfile, imports, public exports, helper utilities, and generic registry tests to resolve exclusively through `@b-apm/integration-api`.
- [x] 2.3 Verify no source/build/test resolver aliases, compatibility packages, or re-export shims resolve any retired package name.

## 3. Migrate Cursor runtime ownership

- [x] 3.1 Move `packages/integration-cursor` to `packages/integration-cursor`, rename it `@b-apm/integration-cursor`, and update its dependency edge to the integration API.
- [x] 3.2 Update the CLI composition root and all test harnesses to register the Cursor integration through the generic integration registry without adding core→Cursor dependencies.
- [x] 3.3 Preserve and verify Cursor detection, primitive deployment, MCP configuration, compile emission, project-root safety, and target-owned inventory reports under the renamed package.

## 4. Extract Claude and Codex marketplace integrations

- [x] 4.1 Create `@b-apm/integration-claude` and `@b-apm/integration-codex` workspace packages with vite-plus TypeScript tooling and dependencies only on the generic integration API and required neutral types.
- [x] 4.2 Define and implement the generic marketplace-output capability so integrations supply host mapping, default path, validation, and output metadata while core retains generic resolve/selection/path-jail/atomic-write orchestration.
- [x] 4.3 Move Claude mapping to the Claude integration and Codex mapping plus category validation to the Codex integration; remove host-specific mapper exports and imports from core.
- [x] 4.4 Register marketplace-only integrations at the pack composition root and verify they are selected without runtime target activation.

## 5. Eradicate legacy namespace and synchronize documentation

- [x] 5.1 Update all live README files, architecture and user docs, inline package/module documentation, test names, fixtures, conformance data, and package descriptions to integration terminology.
- [x] 5.2 Rewrite live main OpenSpec specifications to remove retired package identifiers and synchronize this change's delta specs after implementation; retain retired terms only in archived historical snapshots.
- [x] 5.3 Regenerate workspace lockfile through the package manager and remove all retired package paths, specifiers, and workspace entries.
- [x] 5.4 Make the public package-graph invariant pass: required integration packages resolve to their published identities and retired npm specifiers do not resolve through an alias or compatibility package.

## 6. Verify

- [x] 6.1 Run targeted integration API, Cursor runtime, marketplace-output, package-graph, and repository-audit suites.
- [ ] 6.2 Run workspace formatting, lint/type checks, build, and full test suite; record any intentionally excluded archived-history matches.
- [x] 6.3 Validate the OpenSpec change strictly and confirm all migration acceptance criteria pass before promotion.
