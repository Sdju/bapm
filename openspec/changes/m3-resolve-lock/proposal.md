## Why

Drop-in parity with APM `apm lock` (lockfile-only pipeline) and OpenAPM §7 resolve requires transitive resolve → download into a modules cache → write lock pins, without target deploy. M1/M2 already cover manifest and lock R/W; without M3, `bapm lock` and later install cannot produce real `resolved_commit` / git-semver pins or materialize packages for pinning.

## What Changes

- Add a FEOD **Resolver** module in `@bapm/core`: classify deps (local / git-semver / git-literal / registry-deferred), BFS transitive resolve, OpenAPM **intersection-pick** diamonds (not APM first-wins), depth cap 50, nest refuse, cycle fail-closed
- Download / materialize packages into modules dir **`apm_modules`** (wire parity with APM; `bapm_modules` alias MAY later) via an injectable downloader port
- Orchestrate **`resolveAndLock`**: dual-read manifest (M1) → resolve/download → populate lock via M2 serializer/write-back; M3 hash minimum = `resolved_commit` (+ existing M2/lk envelopes); deeper `tree_sha256` MAY wait for M4
- Skip policy gate until M8 (no-op / omit)
- Add thin **`bapm lock`** in `@bapm/cli` (FEOD command + module) wrapping core; flags subset: `--verbose`, `--update`, `--parallel-downloads`
- **Non-goals:** target deploy / `bapm-target-*`, frozen CI, registry HTTP fetch (**req-rs-009** defer — classify + clear error), `lock export` / `--global` / full policy flags, separate `bapm update` / `deps why`, APM parent-walk discovery, APM first-wins diamonds

## Capabilities

### New Capabilities

- `dependency-resolve`: Core resolve + download + `resolveAndLock` (classify, BFS, intersection-pick, modules cache under `apm_modules`, lock populate via M2, OpenAPM §7 M3 baseline `req-rs-*`)
- `lock-command`: Thin CLI `lock` command over core (`--verbose` / `--update` / `--parallel-downloads`); no target deploy; install remains non-deploying stub

### Modified Capabilities

- `core-feod-architecture`: Add library FEOD module **Resolver** alongside Manifest / Lockfile; public API assembly exports resolve surface
- `cli-runtime-surface`: Register `lock`; help lists `lock`; preserve install stub / no deploy claim

## Impact

- **Primary:** `@bapm/core` — new `modules/Resolver` (classify, graph resolve, download port, modules path constant, `resolveAndLock`); consumes Manifest + Lockfile public APIs only (no deep imports)
- **CLI:** `@bapm/cli` — `commands/lock.ts`, module wrapping core, registry + help update
- **Deps (apply phase):** any git/semver libs via **pnpm CLI + catalog only** (see pnpm-dependencies skill) — not hand-edited in this plan
- **Tests (later):** acceptance from `.samples/apm-knowledge/topics/m3-resolve-lock-acceptance.md` checklist C — not authored in propose
- **Out of scope packages:** targets, docs-only, registry client
