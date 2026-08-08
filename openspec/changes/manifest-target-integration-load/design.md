## Context

See `proposal.md` for motivation. After `manifest-target-integration-map`, Manifest parse accepts object-map `target` / `targets`, retains values, and exposes `declaredTargetIntegrationMap`. Install uses map **keys** only for tg-008 intersection; active host selection is still `--target` / registry detect. CLI composition (`createCliIntegrationRegistry`) hard-registers only `@bapm/integration-cursor`. Core speaks solely through `@bapm/integration-api` and MUST NOT import concrete integrations. Cursor exports `createCursorIntegration()` → `BapmIntegration`; Claude/Codex packages are marketplace-output only and are **not** valid runtime load targets.

## Goals / Non-Goals

**Goals:**

- Product semantics: map = which **package** to attach for a host id; selection of **active** id remains `--target` → detect → fail.
- Load + validate + register map packages in the CLI composition root before core install/compile selection.
- Built-in cursor without map entry; fail-closed for unknown id and bad package/export.
- Document author contract and update VitePress so “never auto-loaded” is no longer absolute.
- Specifier v1: opaque npm package strings Node can resolve from the project (and optionally the CLI install tree).

**Non-Goals:**

- Map replacing detect / choosing active id without `--target` or detect hit.
- Installing map packages as APM `dependencies.*` or rewriting the lock for integrations.
- Multi-active-host materialize in one run.
- Marketplace-only packages as install/compile targets.
- New first-class `path:` / `workspace:` / file URI grammar for map values (follow-up); relative/`file:` strings that ordinary Node resolution already accepts MAY work as opaque strings without new parse rules.
- Core importing `@bapm/integration-*`.

## Decisions

### 1. Product semantics (authoritative)

| Concern | Source of truth |
|--------|------------------|
| Which package implements host `X` | Object-map value for key `X` (when present) |
| Which host is **active** for this run | `--target <id>` if set; else auto-detect among **already registered** integrations; else fail |
| Built-in cursor | CLI registry always; map entry optional |
| Unknown `--target X` | Fail if `X` is not registered after built-ins + successful map loads |
| Bad map package | Fail-closed (resolve or export/contract failure) |

The map never activates a host solely because a key exists. Without `--target`, detect runs on the expanded registry (built-ins + successfully loaded map integrations), so custom hosts can win detect when their `detect()` matches—still not “map picks the id.”

### 2. Where loading runs: CLI composition root

- **Choice:** Before `coreRunInstall` / compile orchestration, CLI: create built-in registry → read project manifest → if `declaredTargetIntegrationMap` is defined, resolve/load/register each entry → pass registry to core.
- **Why:** Matches `integration-package-architecture` (composition root registers packages; core stays free of concrete imports). Dynamic `import()` of arbitrary user packages belongs at the edge.
- **Alternatives:** Core callback/`IntegrationLoader` port — deferred; only introduce if a second composition root needs the same logic without duplicating. Shared pure validators MAY live in CLI `app/integrations/` (or a tiny helper module) without core depending on Node resolution.

### 3. Eager load of all map entries

- **Choice:** When the object-map form is present, attempt to load **every** map entry before selection (not only the eventual active id).
- **Why:** Auto-detect needs custom integrations registered; fail-closed on a broken declared binding is honest (author listed it intentionally).
- **Alternatives:** Lazy load only `--target X` — rejected for detect of custom hosts without always forcing `--target`.

### 4. Resolve model (v1)

- **Choice:** Treat map values as opaque package specifiers resolved with Node ESM resolution rooted at the **project cwd** (consumer `node_modules` / workspace links). Optionally fall back to resolving from the CLI package location for well-known `@bapm/integration-*` already shipped with the CLI distribution. Do **not** network-install the integration as part of this path.
- **Why:** Matches “publish `@acme/...` and depend on it in the project”; keeps trust/supply-chain explicit (user installed the package). Avoids inventing a second package manager inside bapm for integrations.
- **Alternatives:** Auto `npm install` into a bapm cache — out of scope (trust + lock complexity).
- **`path:` / file / workspace:** No new YAML grammar. Follow-up if authors need first-class local integration paths beyond Node-resolvable opaque strings (e.g. `file:../pkgs/my-integration` when Node accepts it). Document as out of scope for v1 dedicated schemes.

### 5. Package export contract

Aligned with `@bapm/integration-api` + cursor package:

A loadable runtime integration package MUST export (first match wins, documented order):

1. Named `createIntegration` — zero-arg (or optional options) factory returning `BapmIntegration`; or
2. Named `createCursorIntegration`-style factory only when it is the package’s documented factory and returns `BapmIntegration` (prefer recommending `createIntegration` for third parties); or
3. Default export that is either a `BapmIntegration` object or a factory returning one.

Loaded instance MUST:

- Satisfy runtime contract: non-empty `id`, `deployRoots` array, `detect` function, `materialize` function (optional `configureMcp` / `compile` allowed).
- Have `id ===` map key (fail-closed on mismatch — map key is the OpenAPM host token the user selected).
- NOT be marketplace-output-only (`marketplaceOutput` without runtime hooks).

Reject Claude/Codex-style marketplace packages when used as map values for install/compile.

### 6. Registry merge with built-in cursor

- **Choice:** Register built-in cursor first. For a map key that already exists in the registry (e.g. `cursor`): if the map value resolves to a valid integration with matching id, **replace** the built-in registration with the loaded instance (author override); if load fails, fail-closed. Keys absent from the map leave built-ins untouched.
- **Why:** Extension without requiring a cursor map row; still allows pin/override via map.
- **Alternatives:** Ignore map entry for built-in ids — rejected (weaker author control).

### 7. Fail-closed diagnostics

Messages MUST name: host id, package specifier, and cause class (unresolvable module / invalid export / id mismatch / missing runtime capability). Remediation hints: add a map entry, install the npm package in the project, or use a registered built-in id. Align tone with existing `Unknown or unregistered target: …`.

### 8. Commands in scope

- **Choice:** Apply the same map-load step for `install` and `compile` (both take `--target` and use the integration registry).
- **Why:** Same selection/registration story; avoids compile-only gaps for custom hosts.
- **Out of scope for this change:** `lock` (no `--target` / materialize), marketplace commands.

### 9. Docs

- Update `config-manifest`: when object-map is present, values **are** loaded/registered before selection; selection rules unchanged; built-in cursor optional in map.
- Architecture: note dynamic registration from map + built-in cursor; clarify Claude/Codex remain marketplace-output unless a future runtime package exists.
- Short author how-to (guide or architecture subsection): publish package → export contract → add as project dependency → declare map → `bapm install --target <id>`.

## Risks / Trade-offs

- [Arbitrary code execution via `import` of mapped packages] → Mitigation: same trust model as any project dependency; document that map values are executed code; no silent network install.
- [Authors put marketplace packages in the map] → Mitigation: validate runtime contract; fail with clear “not a runtime integration” message.
- [Package not installed in project] → Mitigation: fail-closed with install-hint; docs show adding the package as a normal npm/pnpm dep.
- [Eager load slows install when many map entries] → Mitigation: maps are small; defer lazy/cache if needed later.
- [Id override vs factory default id] → Mitigation: require `id ===` key after factory; factories MAY accept `{ id }` like cursor.

## Migration Plan

- Additive behavior for object-map manifests; legacy string/array unchanged (no package load).
- Docs flip from “not loaded” to “loaded when object-map present.”
- Rollback: revert CLI load step; parse/helper remain from prior change.

## Open Questions

- None blocking. Optional later: shared loader helper extracted from CLI for programmatic core callers; first-class `path:` map values.
