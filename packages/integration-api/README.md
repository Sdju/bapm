# bapm-integration-api

Shared **contracts, registry, and materialize helpers** for bapm integrations.

## Boundary

| Package                                            | May depend on                                                  |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `@bapm/core`                                       | `bapm-integration-api` only (no concrete `bapm-integration-*`) |
| `bapm-integration-cursor` (and other integrations) | `bapm-integration-api`                                         |
| CLI / tests                                        | Register concrete integrations into a registry created here    |

Core Install discovers primitives and calls `materialize` on registered integrations through this package. Integration packages implement detection, deploy roots, and disk writes — core never imports them.

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

Integrations keep host-specific detect + routing; shared path/content plumbing lives here.

## Materialize report

`materialize` MAY return a `MaterializeReport`:

```ts
type DeployedFile = { path: string; hash?: string };
type MaterializeReport = { deployedFiles: DeployedFile[] };
```

- `path` — project-/cwd-relative harness path (e.g. `.agents/skills/hello/SKILL.md`)
- `hash` — optional; when omitted, core computes a stable content hash for lock inventory

Core uses this report only via `bapm-integration-api` to write `deployed_file_hashes` and drive orphan cleanup / frozen re-verify. There is no adapter catalog or MCP configure surface in this package.
