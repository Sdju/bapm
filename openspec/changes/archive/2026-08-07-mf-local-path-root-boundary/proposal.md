## Why

`req-mf-016` remains skipped because local dependency paths can currently resolve outside the project root and are read before containment is verified. bapm needs a fail-closed lexical project-root boundary so its Consumer claim is backed by evidence, independently of upstream APM's permissive out-of-tree behavior.

## What Changes

- Recognize all explicit local string forms (`./`, `../`, `/`, `~/`, `.\\`, `..\\`, `~\\`) and object `path` declarations as local dependencies.
- Normalize local-path separators and resolve relative paths from the declaring package directory while enforcing lexical containment within the root project; preserve legitimate in-root normalization such as `./a/../b`.
- Surface a stable resolver domain error, `LOCAL_PATH_ESCAPES_PROJECT_ROOT`, retaining the original path in diagnostics, before manifest reads, remote/registry resolution, policy evaluation, materialization, or lock writing.
- Preserve support for absolute and home-path local classification without adding an absolute/home product-policy ban; containment governs only paths that normalize outside the project root.
- Add resolver and Mode B evidence, activate `req-mf-016`, and regenerate the published conformance statement.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `dependency-resolve`: Local dependency classification and graph resolution gain normalized, declaring-package-relative project-root containment with fail-closed diagnostics.

## Impact

- `@bapm/core` Resolver classification, local graph expansion, exported error/type surface, and resolver tests.
- Mode B checklist, fixture/citation evidence, and generated `CONFORMANCE.md` / `CONFORMANCE.json`.
- No symlink containment, cache-layout redesign, git/registry/marketplace behavioral change, or workspace/monorepo v0.2 work.
