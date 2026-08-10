## Context

See `proposal.md` for motivation. After `manifest-target-integration-load`, CLI `loadManifestIntegrations.ts` eagerly loads every object-map entry via:

1. `createRequire(join(cwd, "package.json")).resolve(specifier)` (fallback: `createRequire(import.meta.url)` for CLI-shipped packages)
2. `import(pathToFileURL(resolved).href)`
3. Export precedence: `createIntegration` → `createCursorIntegration` → default factory/object
4. Runtime contract + `id ===` map key; marketplace-only rejected

Parse still treats map values as opaque non-empty strings (`manifest-target-integration-map`). Active-host selection unchanged. Local filesystem values were explicitly out of scope for dedicated grammar; Node already resolves `./` relative to the require root when passed as opaque strings, but without path classification, containment, or docs.

Project-root containment for APM `path:` / `local` dependencies already exists in `@b-apm/core` Resolver (`resolveLocalPath` / `LOCAL_PATH_ESCAPES_PROJECT_ROOT`). This change applies the same **policy** at the CLI integration loader (may reuse a small shared helper or duplicate the lexical check — prefer reuse if importable without coupling Core to CLI load semantics).

## Goals / Non-Goals

**Goals:**

- Classify map values as path vs npm using `./` / `../` / absolute heuristics (Node-like).
- Resolve local dirs/files with the **existing** `createRequire` + dynamic `import` stack; document that mechanism as authoritative.
- Anchor relative paths at project / manifest cwd (same `cwd` already passed into `registerManifestIntegrations*`).
- Fail-closed on missing path, resolve/import failure, and project-root escape.
- Keep npm strings working; document local-path examples in VitePress.

**Non-Goals:**

- New `path:` / `workspace:` / `file:` map URI grammar.
- Introducing jiti / tsx / vite-plus for TypeScript map entries (`.ts` only if the current Node resolve+import stack already loads it — today it generally does not).
- Changing Manifest parse; changing active-host selection; Core importing concrete integrations.
- Symlink-aware jail beyond lexical containment (unless a shared helper already does more).
- Network-installing map npm packages as a side effect of load.

## Decisions

### 1. Path vs package heuristic (no `path:` prefix)

- **Choice:** Treat as local path iff the trimmed value matches Node-style path forms:
  - starts with `./` or `../`
  - POSIX absolute: starts with `/`
  - Windows absolute: drive form (`^[A-Za-z]:[\\/]`) or UNC `\\` — implement when relevant for CLI OS support
  - Optional: leading `~\` / `~/` classified as path, then fail containment unless somehow inside project root
- **Everything else** (including bare `foo`, `@scope/name`, `foo@version`) remains npm package specifier via existing resolve.
- **Why:** Matches user preference and Node import rules; avoids colliding with package names like `pi` vs `./pi`.
- **Alternatives:** Always try `createRequire.resolve` and inspect result — rejected (ambiguous errors; weaker docs). Dedicated `path:` URI — rejected unless disambiguation becomes necessary later.

### 2. Resolve mechanism = keep current loader stack

- **Choice:** Continue `createRequire(join(cwd, "package.json")).resolve(specifier)` then `import(pathToFileURL(resolved).href)`. For paths, pass the map value through the same `resolve` after containment (or resolve then verify contained). Directory → Node resolution of `exports`/`main`/`index.*` is exactly what `require.resolve` already does. No jiti, no vp-specific loader in this change.
- **Why:** Minimal delta; already proven for npm packages; same export contract.
- **Alternatives:** Pure `import(pathToFileURL(abs))` without createRequire — weaker for package.json main on directories. jiti for `.ts` — out of scope (new toolchain surface).

### 3. Cwd = project / manifest dual-read root

- **Choice:** Relative paths resolve against the same `cwd` already used by `registerManifestIntegrationsFromCwd` / `loadManifest({ cwd })` (consumer project root where `bapm.yml` / `apm.yml` is discovered).
- **Why:** Authors write paths relative to the project, not the CLI install location. CLI fallback resolve for `@b-apm/*` MUST NOT apply to path-classified values (path miss → fail-closed, no “resolve from CLI package”).

### 4. Security: fail-closed project-root containment

- **Choice:** Before import, normalize the intended target under `cwd` and reject if it escapes the project root (same lexical rules as Core `resolveLocalPath`: `relative(root, target)` must not start with `..` or be absolute). Apply to both relative and absolute path-classified values. Absolute in-root paths (rare) are allowed if contained.
- **Why:** Map load executes arbitrary JS; allowing `../../evil` or `/tmp/evil` is an unnecessary trust expansion vs published npm deps the user already installed in-tree. Aligns with `mf-local-path-root-boundary` / local dependency policy.
- **Alternatives:** Allow any absolute path with a warning — rejected (prefer containment). Symlink realpath jail — deferred (non-goal); document limitation.

### 5. Diagnostics

- Reuse `ManifestIntegrationLoadError` with `causeClass: "unresolvable"` for missing path, resolve failure, and containment escape (detail string MUST distinguish escape vs missing vs module-not-found). Do not invent a new cause enum unless tests need a stable machine code — optional `path_escapes_project` cause is acceptable if it clarifies UX without breaking existing tests that only check message/class loosely.
- Still name host id + specifier in the message.

### 6. Docs

- `apps/docs/guide/config-manifest.md`: object-map values = npm package **or** local path (`./…`); note containment and Node directory resolution.
- `apps/docs/architecture/index.md` author how-to: add a local-path bullet/example alongside publish-to-npm flow.
- Help text MAY mention local modules; no requirement to expand `--help` beyond MAY.

### 7. Tests (implementation guidance for later phases)

- Unit: path heuristic; containment reject; directory with package.json main loads; explicit `.js` file loads; npm still works; missing path fails.
- Acceptance: install `--target` with in-tree fixture path under project cwd.

## Risks / Trade-offs

- [Authors omit `./` and write `agents/foo`] → Treated as npm package name → fail unresolvable; docs stress `./` prefix.
- [`.ts` source without build] → createRequire will not load TypeScript; authors must point at built JS or keep a package.json main to JS. Document explicitly.
- [Lexical containment vs symlink escape] → Accepted limitation; same as Core local-path v1.
- [Absolute in-root paths] → Allowed if contained; unusual but consistent.
- [Duplicating containment helper vs importing from Core] → Prefer small shared/reuse path if FEOD-clean; else duplicate lexical check in CLI to avoid wrong dependency direction.

## Migration Plan

- Additive for authors using `./` paths; existing npm map values unchanged.
- Rollback: revert CLI path branch + docs; parse untouched.
- No lockfile / manifest schema migration.

## Open Questions

- None blocking. Optional later: `file:` URI acceptance; TypeScript loader; symlink realpath jail.
