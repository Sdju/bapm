## Context

See `proposal.md` for motivation. Today:

- `packages/cli/src/app/integrations/registry.ts` imports `createCursorIntegration` and eagerly `register`s it in `createCliIntegrationRegistry()`.
- `marketplaceOutputs.ts` statically registers Claude and Codex marketplace-output integrations.
- `@bapm/cli` hard-depends on `@bapm/integration-cursor|claude|codex`.
- Object-map load (`loadManifestIntegrations`) already resolves npm/local packages and registers them; map override can replace built-in cursor.
- Selection (`--target` → `active` → sole detect → fail) is correct and must stay.

## Goals / Non-Goals

**Goals:**

- Empty runtime registry at composition-root construction; populate only via object-map load.
- Empty marketplace-output registry at construction; populate on demand when pack selects formats and packages resolve.
- Remove hard CLI deps on concrete `@bapm/integration-*` (keep `@bapm/integration-api`).
- Align docs/README with CLI-separate + integration-package-separate UX.
- Keep fail-closed selection and map-does-not-activate semantics.

**Non-Goals:**

- New marketplace object-map grammar in the manifest.
- Auto network-install of integration packages during load.
- Changing selection priority or inventing activation from legacy string `target: cursor` alone.
- Shipping Cursor (or Claude/Codex) inside the CLI tarball as optional bundled assets.
- Core importing concrete integrations.

## Decisions

### 1. Runtime registration: map-only (no built-in)

- **Choice:** `createCliIntegrationRegistry()` returns `createIntegrationRegistry()` with **zero** concrete registrations. Install/compile continue to call object-map load when `declaredTargetIntegrationMap` is present; otherwise the registry stays empty and `--target` / `active` / detect fail closed as today for missing ids.
- **Why:** Matches “install integration independently + declare in `targets:`.” Removes the special case that made Cursor first-class inside the CLI.
- **Alternatives:** Keep built-in + optional map override — rejected (product bug). Implicit resolve of `@bapm/integration-<id>` from legacy string `target: cursor` without a map — rejected for this change (would reintroduce magic; authors use object-map).

### 2. Canonical Cursor UX

Documented happy path:

```bash
npm i -g @bapm/cli @bapm/integration-cursor
# or project: npm i -D @bapm/integration-cursor
```

```yaml
targets:
  cursor: "@bapm/integration-cursor"
active:
  - cursor
```

```bash
bapm install --target cursor
```

Legacy string-only `target: cursor` **without** object-map MUST NOT register Cursor after this change.

### 3. Init template emits object-map when `--target` is set

- **Choice:** When `bapm init` records a host id (e.g. `--target cursor`), write object-map `targets: { <id>: "@bapm/integration-<id>" }` (and preferably `active: [<id>]`) instead of only legacy string `target: <id>`, for ids that follow the published `@bapm/integration-<id>` convention. Unknown third-party ids MAY still record preference without inventing a package name—or require the user to supply a map later; prefer documenting Cursor as the worked example.
- **Why:** Otherwise `init -y --target cursor` immediately produces a non-working install path.
- **Alternatives:** Leave init writing string form and rely on docs only — weaker UX.

### 4. CLI package dependencies

- **Choice:** Remove `@bapm/integration-cursor`, `@bapm/integration-claude`, `@bapm/integration-codex` from `@bapm/cli` `dependencies`. Keep `@bapm/integration-api`. Retain project-cwd-first Node resolve; keep optional CLI-adjacent resolve fallback **only when** the package is already installed next to the CLI (no hard dep).
- **Why:** Hard deps force “bundled” semantics and static import pressure.
- **Alternatives:** `optionalDependencies` — still implies distribution affinity; prefer pure external install.

### 5. Marketplace outputs: on-demand load by format

- **Choice:** `createCliMarketplaceOutputRegistry()` starts empty. When pack’s effective format selection includes `claude` / `codex` (or other registered format names owned by known packages), the CLI composition path dynamically resolves a documented package specifier (e.g. `@bapm/integration-claude`), loads the marketplace-output export, and registers it for that run. If the package cannot be resolved or lacks marketplace-output capability, fail closed with install guidance. Do **not** static-import those packages in the composition root.
- **Why:** Parallel to runtime opt-in: package install is the explicit enablement; no new manifest field required for v1.
- **Alternatives:** Manifest map for marketplace packages — deferred. Keep static register — rejected.

### 6. Diagnostics and docs language

- Replace “built-in” / “из коробки” with “registered via object-map” / “install integration package.”
- Unknown-target messages SHOULD mention installing the package and declaring `targets:` (and still mention `--target` / `active`).

### 7. Tests and fixtures

- CLI/core fixtures that assumed built-in Cursor MUST add object-map bindings (and resolve `@bapm/integration-cursor` via workspace/devDependency in the **test** package or fixture node_modules—not via CLI hard dep).
- Invert / remove “built-in cursor works without a map entry.”
- Pack tests that assumed static Claude/Codex MUST install/resolve those packages in the test environment.

## Risks / Trade-offs

- [Breaking UX for string-only `target: cursor`] → Mitigate with init template + docs + clear diagnostics.
- [Global CLI without global/project integration package] → Fail closed with actionable message (expected).
- [Monorepo tests lose CLI→cursor workspace link] → Tests/dev harnesses declare their own deps or use map fixtures under workspace protocol.
- [Pack `--marketplace claude` without package installed] → Fail closed (explicit opt-in).

## Migration Plan

1. Implement empty registries + on-demand marketplace load; drop CLI hard deps.
2. Update init emit; update docs/README.
3. Fix unit/integration fixtures; acceptance covers “no cursor without map” and “cursor via map + installed package.”
4. No rollback shim for built-in registration (intentional break).

## Open Questions

None that block specs/tasks; marketplace dynamic load may use either named export discovery already used for runtime or a small dedicated loader—implementation detail for apply.
