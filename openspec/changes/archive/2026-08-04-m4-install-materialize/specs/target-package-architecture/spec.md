## ADDED Requirements

### Requirement: M4 scaffolds target-api and target-cursor packages
This change MUST create workspace packages at `packages/target-api` (name `bapm-target-api`) and `packages/target-cursor` (name `bapm-target-cursor`), wire them into the pnpm workspace via pnpm CLI as needed, and implement materialization contracts as specified by `target-api-contracts` and `target-cursor-minimal`. Recording architecture alone is no longer sufficient once this change is applied.

#### Scenario: Packages exist after M4 apply
- **WHEN** change `m4-install-materialize` is implemented
- **THEN** `packages/target-api` and `packages/target-cursor` MUST exist on disk with the required package names and vite-plus TypeScript toolchain

## MODIFIED Requirements

### Requirement: Deferred scaffolding
Creating `bapm-target-api` / `bapm-target-*` packages, wiring workspace entries, and implementing materialization MUST wait for an explicit OpenSpec change (or equivalent implementation task). The capability record alone MUST NOT create those packages. Change `m4-install-materialize` IS that explicit change and MUST perform the scaffolding for `bapm-target-api` and minimal `bapm-target-cursor`. Further `bapm-target-*` hosts beyond cursor remain deferred to later changes.

#### Scenario: Spec exists without packages on disk before M4 apply
- **WHEN** this capability is present in `openspec/specs/target-package-architecture` and `m4-install-materialize` has not yet been applied
- **THEN** the repository MAY still lack `packages/target-api` / `packages/target-*` until that change implements them

#### Scenario: M4 change is the scaffolding trigger
- **WHEN** `m4-install-materialize` is applied
- **THEN** scaffolding of `bapm-target-api` and `bapm-target-cursor` MUST proceed as part of that change, and additional host targets beyond cursor MUST remain deferred
