## Context

M5 closed cursor polish and lk-017 lite on frozen install (`deployedInventory` / hash verify inside `modules/Install`). CLI today exposes only `help`, `version`, `install`, `lock`. Normative M6 bar: `.samples/apm-knowledge/topics/m6-lifecycle-acceptance.md`. See `proposal.md` for motivation; behavior contracts in delta specs. FEOD: locked CLI profile + library-core for `@bapm/core`. No new `bapm-target-*`.

## Goals / Non-Goals

**Goals:**
- Thin FEOD CLI surface for update / outdated / uninstall / prune / deps / audit / doctor
- Core domain APIs composing Resolver + Install + Manifest/Lockfile
- `audit --ci` as CI gate (lock + deployed presence + hashes); `outdated` exit 0 when outdated
- lk-010 purge on update; rs-011/rs-012 scoping
- Reuse Install hash/cleanup helpers; no second host package

**Non-Goals (design-level):**
- Full APM audit scanners, SARIF, `--strip`, `--policy`
- Blocking M6 on lk-015 `tree_sha256`
- Producer / Governance / MCP / registry
- New argv framework beyond existing parse patterns

## Decisions

### 1. Core module split (lifecycle vs coalesce)
- **Choice:** Prefer separate directory modules under `packages/core/src/modules/` — `Update`, `Outdated`, `Uninstall`, `Prune`, `Deps`, `Audit`, `Doctor` — each with `index.ts`. Shared hash/cleanup stays in Install (export helpers via Install public API) rather than a new single-purpose hash module. If two APIs are tiny and always co-used (e.g. Uninstall+Prune), they MAY coalesce into one `Lifecycle` module with clear public functions — apply prefers separate modules unless duplication is painful.
- **Why:** Matches library-core FEOD (no single-file modules; public API per concern) and mirrors CLI command map.
- **Alternatives:** One giant `Lifecycle` module — rejected as default (harder public API / testing); put logic only in CLI modules — rejected (core must own domain for tests/fixtures).

### 2. Update = scoped resolve + optional install compose
- **Choice:** `runUpdate` in core: plan via Resolver `updateRefs` + optional `scope: string[]`; apply path writes lock then composes non-frozen install (modules + target materialize) unless `--dry-run`. lk-010: before download for scoped/full git-semver directs under update, delete modules path for that package. Frozen context without override → error (reuse Install frozen mutex semantics).
- **Why:** Reuses M3/M4 paths; matches APM “install --update + plan-and-confirm”.
- **Alternatives:** Fork separate downloader — unnecessary; always skip install compose — rejected (deploy drift).

### 3. Confirm path minimal
- **Choice:** CLI Update module: if `--dry-run` → plan only; if `-y`/`--yes` → apply; else if `process.stdin.isTTY` → simple `Apply? [y/N]` (default No); else fail closed requiring `-y`.
- **Why:** Matches APM non-TTY fail-closed; keeps FEOD command thin.
- **Alternatives:** Always require `-y` — worse UX; soft-apply on non-TTY — unsafe.

### 4. Outdated exit 0; CI = audit --ci
- **Choice:** Document and implement APM-like exit 0 when outdated rows exist. No lock → non-zero. Network/tag listing via existing Resolver ports (`TagLister` / git remote).
- **Why:** User-locked default; avoids false CI red from drift-only.
- **Alternatives:** Non-zero on outdated — rejected for M6.

### 5. Prune is top-level command
- **Choice:** Top-level `bapm prune` (not only `deps prune`) for APM drop-in. Implementation: compute allowed module package dirs from lock graph; delete extras under `apm_modules` (current modules dir name).
- **Why:** Normative open question resolved toward APM naming.
- **Alternatives:** `deps prune` only — worse drop-in.

### 6. deps why SHOULD if cheap
- **Choice:** Implement offline reverse walk from lock if lock already encodes parent/resolved_by edges cheaply; otherwise ship list+tree only and note defer in tasks/README. Do not block M6 accept on why.
- **Why:** User default for gaps.
- **Alternatives:** Mandatory why — may inflate scope if lock graph edges are incomplete.

### 7. audit --ci surface
- **Choice:** Core `runAuditCi`: (1) lock discoverable; (2) optional light consistency (dual-filename conflict already fail); (3) for each `deployed_file_hashes` entry — file exists + hash matches via exported Install verify helper; (4) exit 0/1. Do not require full APM drift replay or policy. lk-015 not in fail set.
- **Why:** Closes M5 soft defer for CI without M8 policy.
- **Alternatives:** Shell out to frozen install — heavier/mutates semantics; skip presence check — weaker than normative.

### 8. Doctor basics only
- **Choice:** Checks: `git` on PATH (critical); manifest/lock load if files present (critical on unreadable); modules dir not a blocking non-directory file. Cursor detect informational MAY. No marketplace/network deep checks.
- **Why:** M6 doctor basics bar.
- **Alternatives:** Full APM marketplace doctor — deferred.

### 9. CLI FEOD wiring
- **Choice:** For each command: `commands/<name>.ts` thin; `modules/<PascalCase>/` with parse+run; `app/init/<name>.ts` soft IoC; register in `app/registry.ts`; constants in `common/constants/commands.ts`. `deps` uses one command handler that dispatches subcommands `list|tree|why`.
- **Why:** Locked FEOD profile.
- **Alternatives:** moduleCommands — forbidden by profile.

### 10. Package allow-list
- **Choice:** Touch `@bapm/core`, `bapm` primarily; `bapm-target-api` / `bapm-target-cursor` only if cleanup/hash report gaps appear. No new workspace packages.
- **Why:** HARD constraint.

## Risks / Trade-offs

- [Resolver lacks package scope today] → Mitigation: add optional `scope` / `updatePackageNames` on resolve options in M6 apply.
- [lk-010 purge races with warm cache] → Mitigation: purge only targeted package dir under modules; keep other packages.
- [deps why expensive without edges] → Mitigation: SHOULD; defer with note.
- [Uninstall manifest edit dual-brand] → Mitigation: write back discovered manifest filename (M1 dual-read rules).
- [Confirm prompts in tests] → Mitigation: acceptance uses `-y` / `--dry-run`; unit-test TTY branch with injectable prompt.
- [tree_sha256 gap vs Consumer green] → Mitigation: explicit soft; list in conformance notes.

## Migration Plan

1. Core: export hash verify from Install → Audit; extend Resolver scope + purge hook → Update/Outdated/Uninstall/Prune/Deps/Doctor APIs.
2. CLI: FEOD modules/commands/registry/help.
3. Existing locks: uninstall/prune/audit work on M5 inventory; pre-M5 locks without hashes → audit presence checks limited / no false hash pass.
4. Rollback: revert change; new CLI commands disappear; locks remain M2-compatible.

## Open Questions

- Exact stdout table formatting for outdated/deps (column widths) — match APM loosely; not spec-blocking.
- Whether `deps why` lands in apply or is deferred after first pass — decide during apply by inspecting lock edge richness; tasks include optional checkbox.
