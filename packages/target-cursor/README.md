# bapm-target-cursor

Minimal **Cursor** host for bapm M4.

## Detection

Activates when the project contains a `.cursor/` directory (presence predicate).

## Deploy roots (tg-002 / tg-003)

Registered roots:

- `.agents/skills` — preferred OpenAPM skills path (`<name>/SKILL.md`)
- `.cursor` — cursor-native companion root (detection + optional native files)

Skills are materialized under `.agents/skills/<name>/SKILL.md` (tg-003). Writes never escape these roots.

## Dependencies

Depends only on `bapm-target-api` among bapm packages — not `@bapm/core`.
Register via `createTargetRegistry().register(createCursorTarget())` in CLI or tests.
