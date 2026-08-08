## Context

The package namespace migration is complete, yet three active OpenSpec slugs, live references, exported integration types, registry factories, and CLI composition names still describe integrations as targets. See `proposal.md` for the motivation. The OpenAPM manifest model and command-line selector deliberately continue to use the target domain term.

## Goals / Non-Goals

**Goals:**

- Establish one active integration vocabulary for architecture, public API, and CLI composition.
- Make the public API rename explicitly breaking, with no retained aliases.
- Keep runtime selection behavior and the OpenAPM target-domain interface stable.
- Preserve archival history and negative legacy-package rejection coverage.
- Specify acceptance as runtime/consumer behavior, never inspection of source text, paths, ASTs, or exported-symbol source declarations.

**Non-Goals:**

- Do not rename manifest fields, lockfile data, OpenAPM concepts, integration identifiers, or `--target`.
- Do not remove or rewrite archived OpenSpec changes.
- Do not add compatibility shims for retired package or public API names.
- Do not change Cursor deployment, MCP, compile, or selection semantics.

## Decisions

### Rename the API as a single breaking boundary

The public API will use `BapmIntegration`, `IntegrationRegistry`, and `createIntegrationRegistry`; all typed API consumers and CLI composition helpers will use the same vocabulary. The legacy names and `createRegistry` alias will be removed rather than deprecated.

This is clearer than keeping aliases because aliases leave the old contract live and contradict the completed package migration. A soft deprecation was considered and rejected because there is no compatibility requirement and it would prolong ambiguous public vocabulary.

### Separate integration mechanics from target-domain selection

Registry ownership, capability dispatch, and CLI composition use `integration` naming. The externally supplied identifier remains a target id, and the manifest plus `--target <id>` retain their OpenAPM-compatible spelling.

Renaming every occurrence mechanically was considered and rejected: it would alter established domain input and user-facing CLI behavior rather than only the integration API boundary.

### Move active specs, preserve archival evidence

The active API and Cursor specs will be moved to `integration-api-contracts` and `integration-cursor-runtime`. `target-package-architecture` will be deleted only after `integration-package-architecture` contains its enduring requirements. Live docs and active specs will link only to replacement slugs. Archived changes remain immutable historical records, including their legacy vocabulary and rejection assertions.

Copying old active specs or editing archives was rejected because duplicate live authorities and rewritten history both obscure the migration boundary.

### Layer verification by contract

Behavioural acceptance will import the public package as a consumer, construct/register integrations, and exercise install/compile target selection through the CLI/core boundary. It will assert that old public imports fail at module resolution and that `--target` remains functional. Documentation/spec slug hygiene is an explicit implementation validation criterion, but it is not an acceptance test and must not be enforced by source-analysis acceptance.

This avoids coupling acceptance tests to implementation layout while still making documentation retirement reviewable.

## Risks / Trade-offs

- [Breaking downstream imports] → Publish the rename as breaking, document the exact replacement vocabulary, and provide no ambiguous alias.
- [Mechanical rename changes OpenAPM domain behavior] → Limit target terminology retention to manifest and CLI selector contracts, with behavior tests for `--target`.
- [Historical cleanup accidentally deletes evidence] → Scope edits to active specs/docs and assert archived change directories remain untouched.
- [Doc links drift despite passing runtime tests] → Include active-reference review and strict OpenSpec validation as release checks outside acceptance.

## Migration Plan

1. Rename active specification directories and repair live references; merge enduring architecture requirements into the canonical integration architecture spec.
2. Rename the API exports and all first-party consumers, composition helpers, labels, and test fixtures; remove aliases.
3. Add consumer-behaviour acceptance tests for the new API, old import rejection, integration selection, and retained `--target` behavior.
4. Run the affected package checks, behavioural suite, strict OpenSpec validation, and a scoped active-doc/spec reference review. Do not modify archive directories.
5. Roll back by reverting the change as one unit; no data migration is required.
