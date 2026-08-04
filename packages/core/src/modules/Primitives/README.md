# Primitives

Discover attributed agentic primitives and resolve name/type conflicts (OpenAPM pr-001..003).

## Public API

- `discoverPrimitives({ cwd?, modulesDir?, declarationOrder? })`
- `resolvePrimitiveConflicts({ primitives, declarationOrder? })` (alias: `resolveConflicts`)
- Types: `AttributedPrimitive`, `PrimitiveSource`, …
- `PrimitivesError`

## Discovery floor (M4)

- Local / dependency `.apm/skills`, `.apm/agents`, `.apm/instructions`
- Package-root `SKILL.md` skill bundle
- Optional `skills/<name>/SKILL.md`

Attribution: `local` | `dependency:<package-name>`.
