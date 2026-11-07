---
name: pnpm-dependencies
description: Manage npm/pnpm dependencies via CLI and pnpm catalogs only—never hand-edit manifests or invent versions. Use when adding, updating, removing, or pinning packages; editing package.json or pnpm-workspace.yaml dependencies; or when the user mentions pnpm, catalog, install, or deps.
---

# pnpm Dependencies

## Rules

1. **CLI only** — add, update, and remove dependencies with the package manager CLI. Do not hand-edit `dependencies` / `devDependencies` / `peerDependencies` / `optionalDependencies` in `package.json`, or catalog version entries in `pnpm-workspace.yaml`.
2. **No guessed versions** — never invent a version from memory. Use `latest` (or another explicit tag), or look up the current version first (`pnpm view <pkg> version`, npm registry, or docs), then install that.
3. **pnpm catalog** — shared dependency versions live in the workspace catalog. Prefer catalog-backed installs so packages use `catalog:` and versions are defined in `pnpm-workspace.yaml`.

## Workflow

### Add a dependency

Prefer saving into the default catalog:

```bash
pnpm add <pkg> --save-catalog
pnpm add -D <pkg> --save-catalog
```

Filter to a workspace package when needed:

```bash
pnpm add <pkg> --save-catalog --filter <package-name>
```

Named catalogs (only if the repo uses them):

```bash
pnpm add <pkg> --save-catalog-name <catalog-name>
```

### Version selection

| Intent             | Approach                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Current release    | `pnpm add <pkg>@latest --save-catalog` or omit the range and let the CLI resolve                                 |
| Specific release   | First: `pnpm view <pkg> version` (or `pnpm view <pkg> versions`), then `pnpm add <pkg>@<version> --save-catalog` |
| Already in catalog | `pnpm add <pkg> --save-catalog` (reuses / prefers catalog under `catalogMode: prefer`)                           |

Do **not** write `^x.y.z` into manifests by hand.

### Update / remove

```bash
pnpm update <pkg>
pnpm update <pkg> --latest
pnpm remove <pkg>
pnpm remove <pkg> --filter <package-name>
```

`pnpm update` updates `catalog:` entries in `pnpm-workspace.yaml` when applicable — still use the CLI, do not patch the catalog by hand.

### Install after clone / lockfile sync

```bash
pnpm install
```

## Forbidden

- Editing dependency version strings or `catalog:` entries directly in `package.json` / `pnpm-workspace.yaml`
- Hardcoding versions from training data or “I think it’s 4.x”
- Adding the same shared dep with divergent literal versions across packages when a catalog entry should exist

## Allowed exceptions

- Non-dependency manifest fields (scripts, `name`, `bin`, exports, etc.) may be edited normally
- Workspace protocol deps (`workspace:`) follow the same CLI-first rule when adding package links
- If the CLI cannot express a rare catalog/override edge case, say so and ask before any manual edit
