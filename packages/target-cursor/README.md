# bapm-target-cursor

Minimal **Cursor** host for bapm (M5 polish).

## Detection vs forced target

| Mode                           | When active                                                                    | Creates roots?                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Auto-detect**                | `.cursor/` **directory** **or** legacy `.cursorrules` **file** at project root | Only when materialize runs after a positive detect                                                       |
| **Forced** (`--target cursor`) | Explicit CLI/core forced target id, even if detect is false                    | MAY `mkdir` registered roots (`.cursor/`, `.agents/skills`, `.cursor/rules`, `.cursor/agents`) as needed |

Auto-detect without force MUST NOT create `.cursor/` solely for MCP opt-in. Forced activation is owned by Install / CLI; this package’s `detect` stays an honest presence predicate.

## Deploy roots (tg-002 / tg-003)

Registered roots:

- `.agents/skills` — skills → `<name>/SKILL.md`
- `.cursor` — companion root (detection + rules/agents)

## Materialize routing

| Primitive type | Destination                      |
| -------------- | -------------------------------- |
| skill          | `.agents/skills/<name>/SKILL.md` |
| instruction    | `.cursor/rules/<name>.mdc`       |
| agent          | `.cursor/agents/<name>.md`       |

Thin copy/write from source content (minimal frontmatter only when content is missing). Writes are idempotent overwrites, never escape registered roots, and **never** write `.cursor/mcp.json`.

`materialize` returns a `MaterializeReport` (`deployedFiles: { path }[]`) via `bapm-target-api` for lock inventory.

## Dependencies

Depends only on `bapm-target-api` among bapm packages — not `@bapm/core`.
Shared materialize helpers (`sanitizeName`, `assertUnderDeployRoots`, `readPrimitiveContent`, …) come from `bapm-target-api`; this package keeps Cursor detect and path routing only.
Register via `createTargetRegistry().register(createCursorTarget())` in CLI or tests.
