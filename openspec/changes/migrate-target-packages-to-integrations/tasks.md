## 1. Characterize and guard the migration

- [ ] 1.1 Add RED acceptance coverage for renamed API and Cursor package identities, successful generic registry injection, and rejection of legacy specifier resolution.
- [ ] 1.2 Add RED acceptance coverage that characterizes current Cursor detect, materialize, MCP, compile, root-safety, and inventory-report behavior through the integration API.
- [ ] 1.3 Add RED acceptance coverage for Claude and Codex output selection, unchanged default paths and JSON semantics, Codex category failure, path jail, and marketplace-only registration.
- [ ] 1.4 Add RED repository-audit coverage that scans all live source, manifests, lockfile, tests, docs, fixtures, and main OpenSpec specs for retired package names, with only `.git`, dependencies, and archived OpenSpec snapshots excluded.

## 2. Rename the generic boundary

- [ ] 2.1 Move `packages/target-api` to `packages/integration-api`, rename the package to `bapm-integration-api`, and rename public contract terminology only where it denotes the package boundary rather than a generic runtime concept.
- [ ] 2.2 Update `@bapm/core`, CLI, workspace manifests, lockfile, imports, public exports, helper utilities, and generic registry tests to resolve exclusively through `bapm-integration-api`.
- [ ] 2.3 Verify no source/build/test resolver aliases, compatibility packages, or re-export shims resolve any retired package name.

## 3. Migrate Cursor runtime ownership

- [ ] 3.1 Move `packages/target-cursor` to `packages/integration-cursor`, rename it `bapm-integration-cursor`, and update its dependency edge to the integration API.
- [ ] 3.2 Update the CLI composition root and all test harnesses to register the Cursor integration through the generic integration registry without adding core→Cursor dependencies.
- [ ] 3.3 Preserve and verify Cursor detection, primitive deployment, MCP configuration, compile emission, project-root safety, and target-owned inventory reports under the renamed package.

## 4. Extract Claude and Codex marketplace integrations

- [ ] 4.1 Create `bapm-integration-claude` and `bapm-integration-codex` workspace packages with vite-plus TypeScript tooling and dependencies only on the generic integration API and required neutral types.
- [ ] 4.2 Define and implement the generic marketplace-output capability so integrations supply host mapping, default path, validation, and output metadata while core retains generic resolve/selection/path-jail/atomic-write orchestration.
- [ ] 4.3 Move Claude mapping to the Claude integration and Codex mapping plus category validation to the Codex integration; remove host-specific mapper exports and imports from core.
- [ ] 4.4 Register marketplace-only integrations at the pack composition root and verify they are selected without runtime target activation.

## 5. Eradicate legacy namespace and synchronize documentation

- [ ] 5.1 Update all live README files, architecture and user docs, inline package/module documentation, test names, fixtures, conformance data, and package descriptions to integration terminology.
- [ ] 5.2 Rewrite live main OpenSpec specifications to remove retired package identifiers and synchronize this change's delta specs after implementation; retain retired terms only in archived historical snapshots.
- [ ] 5.3 Regenerate workspace lockfile through the package manager and remove all retired package paths, specifiers, and workspace entries.
- [ ] 5.4 Make the repository-wide denylist audit pass with zero live matches for `bapm-target-`, `packages/target-api`, and `packages/target-cursor`, and prove old npm specifiers do not resolve.

## 6. Verify

- [ ] 6.1 Run targeted integration API, Cursor runtime, marketplace-output, package-graph, and repository-audit suites.
- [ ] 6.2 Run workspace formatting, lint/type checks, build, and full test suite; record any intentionally excluded archived-history matches.
- [ ] 6.3 Validate the OpenSpec change strictly and confirm all migration acceptance criteria pass before promotion.
