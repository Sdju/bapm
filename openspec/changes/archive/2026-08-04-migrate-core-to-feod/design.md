## Context

See `proposal.md` for motivation. Current `packages/core/src` is flat folders `manifest/` and `lockfile/` plus root `index.ts` that re-exports everything. Lockfile already depends on Manifest internals (`loadYamlDocument`, `ManifestError` mapping in `lockfile/parse.ts`). CLI already has a separate locked FEOD profile (`layerDirs.pages` → `commands`); this change introduces a **library** profile for core only. Existing M1/M2 acceptance and unit tests import public symbols from `src/index.ts`.

## Goals / Non-Goals

**Goals:**

- Map existing Manifest/Lockfile code onto library FEOD layers without changing observable `@bapm/core` behavior or export names.
- Break Lockfile → Manifest deep imports by moving shared YAML to `common`.
- Keep `vp pack` / `vp test` / `vp check` green; M1/M2 acceptance stay green.
- Document the library profile without rewriting CLI locked FEOD rules.

**Non-Goals:**

- Changing CLI FEOD skill locked table / `cli-feod-architecture` requirements.
- Implementing resolver, install, primitives, or target packages.
- Adding feod ESLint plugin.
- Changing semantic validation rules of manifest/lockfile YAML.

## Decisions

### D1 — Library FEOD profile (packages/core only)

| Parameter | Value |
|-----------|-------|
| scope | `packages/core` |
| modification | base (library) |
| multiapp | no |
| framework | none / library (TypeScript ESM) |
| srcRoot | `src` |
| alias | `@` → `src` |
| layerDirs | `app`, `pages`→**`pages`**, `modules`, `common`, `globals` |
| pages | empty stub (`.gitkeep`); no domain handlers |
| moduleCommands / private pages | N/A / unused |
| common.allowIndex | false |
| modules.allowDeepImports | false |
| singleFileModules | no |
| IoC | soft (optional; not required for pure library modules yet) |

`feod` block in `packages/core/package.json`:

```json
{
  "feod": {
    "srcRoot": "src",
    "aliasPrefix": "@",
    "layerDirs": {
      "app": "app",
      "pages": "pages",
      "modules": "modules",
      "common": "common",
      "global": "globals"
    },
    "common": { "allowIndex": false },
    "modules": {
      "publicEntry": "index.ts",
      "allowDeepImports": false,
      "singleFileModules": false
    },
    "pages": {
      "useFileBasedRouting": false,
      "modulePages": false,
      "privateModulesPrefix": null
    }
  }
}
```

**Rationale:** Explore lock-in — library profile distinct from CLI (`pages` stays `pages`, not `commands`).  
**Alternatives considered:** Reuse CLI `commands` naming — rejected (no CLI commands in a library). Extend `cli-feod-architecture` — rejected (separate capability).

### D2 — Target layout

```
packages/core/src/
  app/
    publicApi.ts      # assembles package named exports from modules + package consts
  modules/
    Manifest/
      index.ts        # public API
      discover.ts / load.ts / parse.ts / types.ts / errors.ts / …
      README.md       # brief
    Lockfile/
      index.ts
      discover.ts / load.ts / parse.ts / serialize.ts / …
      README.md
  common/
    yaml/
      loadDocument.ts # safe-subset YAML parse (concrete path; no barrel)
      errors.ts       # neutral YamlError (or equivalent) for common layer
    # NO index.ts
  pages/
    .gitkeep          # empty stub only
  globals/            # empty or ambient later
  index.ts            # thin: export * from app/publicApi (or explicit re-exports)
```

**Rationale:** Matches FEOD pillars; thin root entry preserves pack export `.` → `dist/index.mjs`.  
**Alternatives considered:** Keep flat `manifest/`/`lockfile/` at src root — rejected (not FEOD). Put YAML inside Manifest and re-export to Lockfile via Manifest public API — weaker (Lockfile would depend on Manifest module for infra).

### D3 — Shared YAML in common (break Manifest deep import)

Today `lockfile/parse.ts` imports `../manifest/yaml-load` and `ManifestError`, then maps to `LockfileError`.

Target:

1. Move safe-subset loader to `@/common/yaml/loadDocument` (name may stay `loadYamlDocument` as function).
2. Common throws a **neutral** error type (e.g. `YamlError` with codes for parse / safe-subset) — not `ManifestError`.
3. `modules/Manifest` wraps common errors → `ManifestError` for `loadYamlDocument` **public** behavior (preserve current consumer-facing error type/codes for the exported `loadYamlDocument`).
4. `modules/Lockfile` wraps common errors → `LockfileError` directly (no Manifest import).

**Rationale:** FEOD common for shared non-module entities; eliminates zigzag/deep cross-module coupling.  
**Alternatives considered:** Keep throwing `ManifestError` from common — rejected (common must not depend on Manifest types). Duplicate YAML loader in both modules — rejected (drift risk).

### D4 — Modules public API and app/publicApi

- Each module `index.ts` exports only what the package surface needs from that domain (mirroring today’s root re-exports).
- `app/publicApi.ts` re-exports Manifest + Lockfile public APIs plus package-level `BAPM_NAME` / `getVersion`.
- Root `src/index.ts` only re-exports from `@/app/publicApi` (or relative `./app/publicApi.ts`).

**Export parity checklist (must remain named exports):**

- Manifest types, `ManifestError`, `ManifestErrorCode`, `ManifestWarning`, `APM_MANIFEST_FILE`, `BAPM_MANIFEST_FILE`, `discoverManifestPath`, `loadManifest`, `parseManifest`, `parseManifestDocument`, `loadYamlDocument`
- Lockfile types, `LockfileError`, `LockfileErrorCode`, `APM_LOCK_FILE`, `BAPM_LOCK_FILE`, `discoverLockfilePath`, `loadLockfile`, `loadLockfileOrNull`, `writeLockfile`, `parseLockfile`, `parseLockfileDocument`, `serializeLockfile`, `isSemanticallyEquivalent`
- `BAPM_NAME`, `getVersion`

**Rationale:** Proposal requires 1:1 named export stability so CLI and tests need no changes.  
**Alternatives considered:** Subpath exports per module — out of scope / would be BREAKING for current single-entry consumers.

### D5 — Alias and tooling

- Add `compilerOptions.paths`: `"@/*": ["./src/*"]` in `packages/core/tsconfig.json` (keep `moduleResolution: nodenext`; paths used for FEOD cross-level imports).
- If `vp pack` / type-aware lint does not inherit paths, add matching `resolve.alias` in `vite.config.ts` during apply.

**Rationale:** Cross-level imports MUST use `@/`.  
**Alternatives considered:** Relative cross-level only — violates FEOD path rules.

### D6 — FEOD skill documentation (do not break CLI locked rules)

Add a **separate** note file, e.g. `.cursor/skills/feod/library-core.md`, describing the library profile for `packages/core` (table from D1 + layout). Optionally add a one-line pointer at the bottom of `SKILL.md` / `reference.md` under “Дополнительно” — **without** changing the locked CLI profile table or “Не предлагай pages…” CLI wording.

**Rationale:** Explore asked to note core library profile without breaking CLI locked rules.  
**Alternatives considered:** Merge library rules into the main locked CLI table — rejected (would confuse profiles). Rewrite SKILL to dual-profile as primary — deferred; note file is enough for this change.

### D7 — Soft IoC

Pure domain modules do not require IoC factories for this migration. Soft IoC MAY appear later when resolver/install need injectable deps. No `app/init` wiring required now unless a clear external side-effect boundary appears (none today beyond `node:fs` inside modules — leave as-is).

**Rationale:** Avoid over-engineering a library migrate.  
**Alternatives considered:** Force `createManifest`/`createLockfile` factories everywhere — rejected for this change.

### D8 — Closed explore defaults

| Topic | Decision |
|-------|----------|
| pages dir | `pages` + `.gitkeep`, not `commands` |
| modules | `Manifest`, `Lockfile` |
| shared YAML | `common`, no barrel |
| package entry | thin `index.ts` → `app/publicApi` |
| OpenSpec capability | new `core-feod-architecture` only |
| CLI code | unchanged if exports stable |
| verify | M1/M2 acceptance + core unit/check green |

## Risks / Trade-offs

- [Public `loadYamlDocument` error type drift] → Manifest wrapper MUST keep throwing `ManifestError` with existing codes for the exported function; Lockfile mapping stays on common errors.
- [`@/*` + `nodenext` / vp pack] → Verify in apply; add vite alias if pack/tests fail to resolve.
- [Accidental deep imports during file move] → Import checklist in tasks; grep for `modules/.*/` deep paths and old `manifest/`/`lockfile/` roots.
- [Test fixtures / relative paths] → Prefer keeping tests importing from `src/index.ts` only so internal moves are invisible.
- [Dual FEOD profiles confuse agents] → Separate note file + explicit “do not change CLI locked rules” in tasks.

## Migration Plan

1. Add `feod` config + `@/*` paths (+ vite alias if needed).
2. Create layer dirs including empty `pages/.gitkeep` and `globals/`.
3. Move YAML loader to `common/yaml/` with neutral error; update Manifest/Lockfile wrappers.
4. Move remaining files into `modules/Manifest` and `modules/Lockfile`; add `index.ts` public APIs.
5. Add `app/publicApi.ts`; thin `src/index.ts`.
6. Remove old `src/manifest` / `src/lockfile` trees.
7. Write `.cursor/skills/feod/library-core.md` (+ optional pointer).
8. Run `vp check`, `vp test` (unit + M1/M2 acceptance) in `packages/core`; smoke CLI only if needed (exports unchanged → no CLI edits).
9. Rollback: revert branch; no data migration.

## Open Questions

None — explore decisions are locked in D1–D8.
