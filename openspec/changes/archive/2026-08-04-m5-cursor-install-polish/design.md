## Context

M4 left `bapm-target-cursor` skills-only (detect `.cursor/` dir), CLI install soft-ignoring unknown flags, core tests aliasing `bapm-target-cursor` in `packages/core/vite.config.ts`, and no lock write-back of `deployed_file_hashes` / orphan cleanup despite M2 lock schema already modeling those fields. See `proposal.md` for motivation; normative checklist: `.samples/apm-knowledge/topics/m5-cursor-install-acceptance.md`. Behavior contracts: delta specs under this change. FEOD locked for CLI (`packages/cli`) and library FEOD for core Install/Primitives — no new single-file modules; no core→cursor hard dep.

## Goals / Non-Goals

**Goals:**

- Cursor drop-in floor: skills + instructions→`.cursor/rules/*.mdc` + agents→`.cursor/agents/*.md`
- Clear detect vs forced-target semantics; MCP out
- Install UX: accurate help, hard unknown flags, frozen mutex, `--target`
- lk-017 lite: write hashes + frozen re-verify; orphan cleanup from inventory
- Remove core vite cursor alias; keep package graph invariant (api only in core)

**Non-Goals (design-level):**

- Second `bapm-target-*` host or adapter catalog
- Full APM transformers for commands/hooks; MCP `.cursor/mcp.json`
- Full M6 lifecycle / audit / gitignore heal
- Changing lock dual-read discovery rules beyond writing existing hash fields

## Decisions

### 1. Forced `--target cursor` vs auto-detect

- **Choice:** Auto-detect requires `.cursor/` **directory** OR legacy `.cursorrules` **file**. Explicit `--target cursor` forces activation even without those signals and MAY `mkdir` registered roots (`.cursor/`, `.agents/skills`, `.cursor/rules`, `.cursor/agents` as needed). Never create `.cursor/` solely for MCP opt-in.
- **Why:** Matches user-locked M5 default and APM-ish “force target” while keeping auto-detect honest.
- **Alternatives:** Always require `.cursor/` even with `--target` — rejected (blocks bootstrap); auto-create on detect miss — rejected (silent harness).

### 2. Materialize report via target-api return value

- **Choice:** Extend `materialize` contract to return (or attach) `{ deployedFiles: { path, hash? }[] }` (names flexible). Cursor computes paths it wrote; core hashes if needed (prefer hash in core with stable algo, e.g. sha256 of file bytes) and writes lock `deployed_file_hashes` keyed by dep / path per existing Lockfile types.
- **Why:** Keeps host FS knowledge in cursor; inventory/policy in core; no core import of cursor.
- **Alternatives:** Core walks registered roots after materialize — rejected (cannot distinguish orphans from user files); cursor writes lock — rejected (boundary violation).

### 3. Orphan cleanup scope

- **Choice:** Only delete paths present in previous lock inventory for deps no longer in the resolved set. If inventory missing (pre-M5 locks), skip cleanup (no fail) and start recording hashes going forward.
- **Why:** Fail-safe vs deleting unknown harness trees; enables lk-017 lite without full APM cleanup parity.
- **Alternatives:** Wipe all registered roots each install — rejected (destructive to user edits outside inventory).

### 4. Primitive type routing in cursor

- **Choice:** Thin file copy / write by primitive `type`: skill → `.agents/skills/<name>/SKILL.md`; instruction → `.cursor/rules/<name>.mdc`; agent → `.cursor/agents/<name>.md`. Prefer source file content; minimal frontmatter only if content missing. Commands/hooks **not** required (MAY later).
- **Why:** Drop-in useful vs APM matrix without lossy transformer scope.
- **Alternatives:** Full APM transformers — deferred.

### 5. CLI flag parsing (FEOD)

- **Choice:** Harden `packages/cli` `modules/Install` `parseInstallArgs`: unknown `--*` → error string; keep `--frozen` / `--update` mutex; add `--target <id>` (consume next argv token). Thin `commands/install.ts` unchanged in role. Help strings updated in Install/help module surfaces.
- **Why:** Closes M4 soft-ignore; FEOD keeps domain parse in module, command thin.
- **Alternatives:** New argv library — unnecessary for subset.

### 6. Drop core vite alias; e2e ownership

- **Choice:** Remove `bapm-target-cursor` alias from `packages/core/vite.config.ts`. Core unit tests use mock `BapmTarget` via api. Cursor e2e that needs real package lives primarily under `packages/cli` and/or `packages/target-cursor` tests; core MAY keep e2e only if resolved through workspace without alias and without adding cursor to core `package.json` — prefer moving cursor-e2e out of core.
- **Why:** Spec forbids alias workaround; preserves core↔api boundary.
- **Alternatives:** Add cursor as optional/devDependency of core — rejected (graph smell / hard edge risk).

### 7. Package allow-list

- **Choice:** Touch only `@bapm/core`, `bapm` (cli), `bapm-target-api`, `bapm-target-cursor`. No new workspace packages.
- **Why:** HARD M5 constraint while api churns.

## Risks / Trade-offs

- [Pre-M5 locks lack hashes] → Mitigation: orphan cleanup no-ops until inventory exists; document in README/validation.
- [User-edited rules outside inventory deleted incorrectly] → Mitigation: delete only recorded paths.
- [mdc/agent thin copy loses APM FM transforms] → Mitigation: accept for M5; note in target-cursor README.
- [Moving core cursor e2e breaks coverage] → Mitigation: relocate assertions to cli/target-cursor packages with same fixtures.
- [Hash algo mismatch vs APM] → Mitigation: document bapm algo; interoperability with APM lock hashes is best-effort, not M5 pass gate.

## Migration Plan

1. Implement api contract extension → cursor materialize polish → core Install inventory/cleanup/frozen verify → CLI flags/help → remove vite alias / relocate e2e.
2. Existing projects: next non-frozen install populates hashes; subsequent frozen gains lk-017 lite.
3. Rollback: revert change artifacts/packages to M4 behavior; locks with new hash fields remain readable by M2 parser.

## Open Questions

- Exact CLI help wording / whether `bapm help install` vs `install --help` both required — implement both if cheap, else document one entry.
- Whether lk-018 (`CI` → frozen) lands as MAY in apply — optional task, not blocking M5 pass.
