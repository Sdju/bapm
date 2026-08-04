# bapm-target-api

Shared **contracts, registry, and materialize helpers** for bapm host targets.

## Boundary

| Package                                | May depend on                                          |
| -------------------------------------- | ------------------------------------------------------ |
| `@bapm/core`                           | `bapm-target-api` only (no concrete `bapm-target-*`)   |
| `bapm-target-cursor` (and other hosts) | `bapm-target-api`                                      |
| CLI / tests                            | Register concrete targets into a registry created here |

Core Install discovers primitives and calls `materialize` on registered targets through this package. Host packages implement detection, deploy roots, and disk writes — core never imports them.

## Helpers

Optional fs/path helpers for host `materialize` (exported from the package root):

| Symbol                   | Role                                             |
| ------------------------ | ------------------------------------------------ |
| `primitivesList`         | Normalize array / `{ primitives }` sets          |
| `sanitizeName`           | Path-safe single segment from a primitive name   |
| `isUnderRoot`            | Containment check under a deploy root            |
| `assertUnderDeployRoots` | Refuse writes outside registered roots           |
| `readPrimitiveContent`   | Inline content / source file / stub frontmatter  |
| `toPosixRel`             | Absolute → cwd-relative path with `/` separators |

Hosts keep target-specific detect + routing; shared path/content plumbing lives here.

## Materialize report

`materialize` MAY return a `MaterializeReport`:

```ts
type DeployedFile = { path: string; hash?: string };
type MaterializeReport = { deployedFiles: DeployedFile[] };
```

- `path` — project-/cwd-relative harness path (e.g. `.agents/skills/hello/SKILL.md`)
- `hash` — optional; when omitted, core computes a stable content hash for lock inventory

Core uses this report only via `bapm-target-api` to write `deployed_file_hashes` and drive orphan cleanup / frozen re-verify. There is no adapter catalog or MCP configure surface in this package.
