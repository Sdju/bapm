## Why

After M3 (`resolveAndLock` + modules cache + `bapm lock`), consumers still cannot materialize host primitives or run a real install: `bapm install` is a failing stub, there is no primitives discovery, and no `bapm-target-api` boundary for deploy. M4 closes the OpenAPM Consumer subset for install wire (pr-001..003, tg-008/004/002, tg-003 if skills, basic lk-006) without cloning APM's in-tree adapter catalog.

## What Changes

- Add FEOD modules **Install** and **Primitives** in `@bapm/core`: discover/attribute/conflict-resolve primitives; orchestrate install (reuse M3 resolve/download); enforce basic `--frozen` (lk-006); invoke deploy only through `bapm-target-api` registration/contracts
- **MUST scaffold** workspace packages:
  - `packages/target-api` → npm name **`bapm-target-api`** (TS + vite-plus) — contracts/types/registration utilities
  - `packages/target-cursor` → npm name **`bapm-target-cursor`** (minimal e2e materialize; depends on `bapm-target-api` only)
- Wire both into the pnpm workspace at apply via **pnpm CLI + catalog** (not hand-edited manifests in propose)
- Core **MUST NOT** hard-depend on `bapm-target-cursor` (injection/registration via api only); CLI/workspace MAY depend on cursor for e2e wiring
- Un-stub `@bapm/cli` `install` for the happy path (thin FEOD command → module → core install); support basic `--frozen`
- Preserve M3 invariant: `bapm lock` still does **not** deploy harness files
- **Non-goals:** in-tree APM adapters; multi-adapter catalog; M5 polish (orphan cleanup, gitignore, richer cursor, extra `bapm-target-*`); policy (M8); compile/MCP/registry (M9/M10); full lk-017/018; producer pr-004/005

## Capabilities

### New Capabilities

- `install-pipeline`: Core Install orchestration after M3 — modules placement, lock write-back (unless frozen), active-target intersection (tg-008), deploy only via registered target-api contracts (tg-002 posture), basic frozen gate (lk-006), vendor target id accept (tg-004)
- `primitives-discovery`: Core Primitives discovery + source attribution + conflict resolution (OpenAPM pr-001, pr-002, pr-003); skill-bundle floor; typed `.apm/` skills/agents/instructions minimum
- `target-api-contracts`: Package `bapm-target-api` at `packages/target-api` — TypeScript contracts for target id, detection, deploy roots, register/materialize; shared boundary for core and all `bapm-target-*`
- `target-cursor-minimal`: Package `bapm-target-cursor` at `packages/target-cursor` — minimal Cursor host: detect predicate + materialize skills into registered roots only (tg-002; tg-003 when skills ship)

### Modified Capabilities

- `target-package-architecture`: Lift deferred-scaffolding for this change — MUST create `packages/target-api` / `packages/target-cursor` with names `bapm-target-api` / `bapm-target-cursor`; keep no-in-core-adapter and vite-plus rules
- `core-feod-architecture`: Add library FEOD modules **Install** and **Primitives** alongside Manifest / Lockfile / Resolver; public API re-exports
- `cli-runtime-surface`: Replace install failing-stub requirement with thin happy-path install over core (+ `--frozen`); help describes real install; lock remains non-deploying
- `lock-command`: Reaffirm lock MUST NOT invoke target materialize / harness writes (M3 invariant under M4)

## Impact

- **Primary:** `@bapm/core` — `modules/Install`, `modules/Primitives`; depends on **`bapm-target-api` only** among target packages; consumes Resolver / Manifest / Lockfile public APIs
- **New packages:** `packages/target-api` (`bapm-target-api`), `packages/target-cursor` (`bapm-target-cursor`) — TS ESM + vite-plus; workspace membership via pnpm CLI at apply
- **CLI:** `@bapm/cli` — un-stub `modules/Install` + `commands/install.ts`; optional workspace dep on `bapm-target-cursor` for e2e registration without core importing it
- **Deps (apply):** add workspace packages and any shared libs via **pnpm CLI + catalog only** (pnpm-dependencies skill) — propose does not invent versions
- **Tests (later):** acceptance from `.samples/apm-knowledge/topics/m4-install-acceptance.md` checklist C — not authored in propose
- **Out of scope:** adapter catalog, policy, compile, registry, full cleanup/audit, MCP freeze depth beyond stub if MCP out of M4
