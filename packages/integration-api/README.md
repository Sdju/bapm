# @bapm/integration-api

Shared **contracts, registry, and materialize helpers** for bapm integrations.

## Boundary

| Package                                             | May depend on                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `@bapm/core`                                        | `@bapm/integration-api` only (no concrete `@bapm/integration-*`) |
| `@bapm/integration-cursor` (and other integrations) | `@bapm/integration-api`                                          |
| CLI / tests                                         | Register concrete integrations into a registry created here      |

Core Install discovers primitives and calls `materialize` on registered integrations through this package. Integration packages implement detection, deploy roots, and disk writes — core never imports them.

## Loadable package export contract (object-map)

When a project manifest uses object-map `target` / `targets`, the CLI loads each map value as an npm package from the project cwd and registers a runtime `BapmIntegration`. A loadable package MUST expose (first match wins):

1. Named **`createIntegration`** — zero-arg factory returning `BapmIntegration` (preferred for third parties); or
2. Named **`createCursorIntegration`** (or an equivalent documented factory) returning `BapmIntegration`; or
3. **Default export** that is either a `BapmIntegration` object or a factory returning one.

The loaded instance MUST have non-empty `id`, `deployRoots` array, `detect`, and `materialize` (`configureMcp` / `compile` optional). `id` MUST equal the map key. Marketplace-output-only packages (no runtime hooks) are rejected.

See `@bapm/integration-cursor` for a built-in reference and the VitePress architecture guide for the author how-to.

## Helpers

Optional fs/path helpers for host `materialize` (exported from the package root):

| Symbol                       | Role                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| `primitivesList`             | Normalize array / `{ primitives }` sets                           |
| `primitivesMaterialize`      | Dispatch primitives to `skill` / `instruction` / … handlers       |
| `sanitizeName`               | Path-safe single segment from a primitive name                    |
| `isUnderRoot`                | Containment check under a deploy root                             |
| `assertUnderDeployRoots`     | Refuse writes outside registered roots                            |
| `readPrimitiveContent`       | Inline content / source file / stub frontmatter                   |
| `toPosixRel`                 | Absolute → cwd-relative path with `/` separators                  |
| `findPackageRoot`            | Nearest `apm.yml` / `bapm.yml` / `plugin.json` ancestor           |
| `isWithin`                   | Path containment (`candidate` under `root`)                       |
| `listFiles`                  | Recursive file listing (absolute paths)                           |
| `copyPortableSkillDirectory` | Safe Agent Plugin skill tree copy (no symlink escape)             |
| `materializeSkill`           | Shared skill deploy (portable tree / SKILL.md / stub + inventory) |

Prefer `primitivesMaterialize({ skill() {…}, … })` over a manual `primitivesList` loop.
Use `materializeSkill({ destDir })` inside the `skill` handler — hosts only pick the path.
Integrations keep host-specific detect + destinations; shared path/content plumbing lives here.

## Materialize report

`materialize` MAY return a `MaterializeReport`:

```ts
type DeployedFile = { path: string; hash?: string };
type MaterializeReport = { deployedFiles: DeployedFile[] };
```

- `path` — project-/cwd-relative harness path (e.g. `.agents/skills/hello/SKILL.md`)
- `hash` — optional; when omitted, core computes a stable content hash for lock inventory

Core uses this report only via `@bapm/integration-api` to write `deployed_file_hashes` and drive orphan cleanup / frozen re-verify. There is no adapter catalog or MCP configure surface in this package.
