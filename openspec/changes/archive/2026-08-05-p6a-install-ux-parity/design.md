## Context

See proposal.md — Why. Baseline: CLI `parseInstallArgs` accepts zip positional only; core `RunInstallOptions` already has `parallelDownloads` / `verbose` but no `dryRun`, packageRefs, or exclude; `runInstall` always may call `materialize` / `configureMcp`; frozen keeps OpenAPM pin + lk-015/017 + lk-018. Criteria: `.samples/apm-knowledge/topics/p6a-install-ux-parity-criteria.md`.

## Goals / Non-Goals

**Goals:**

- Single `dryRun` on core install API; orchestrator short-circuits write side-effects.
- APM-like positional add + auto-create manifest; zip disambiguation.
- CLI parity flags wired to core; `--exclude cursor` gates MCP only.
- Document frozen soft-align without CI breakage.

**Non-Goals:**

- Resolver-backed dry-run; multi-target; `--dev`/`--only`/`--force`/`--mcp` add; changing MCP-without-`.cursor` mkdir policy; weakening integrity.

## Decisions

### D1: dryRun lives only on core `runInstall` / public install options

- **Choice:** Add `dryRun?: boolean` (and CLI `--dry-run`) to core options. Early return after manifest load + direct-deps preview + optional policy preflight on directs. Never pass dryRun into `BapmTarget`.
- **Alternatives:** (a) dryRun on every target method — rejected (criteria forbid); (b) CLI-only fake preview — rejected (API callers need same guarantee).
- **Write prohibition list (MUST):** no `extractPackArchive` into project; no manifest write; no lock write; no modules durable materialize; no orphan deletes; no `target.materialize`; no `configureMcp`. Prefer skip over no-op wrappers; if a wrapper is used, it lives in core/CLI wiring only.

### D2: Dry-run preview depth = APM default (no full resolver)

- **Choice:** Preview direct `dependencies.apm` (+ MCP deps view from manifest) and run policy discovery/eval against that direct set when policy is enabled. Do not call full `resolveAndLock` / download for dry-run in P6a.
- **Alternatives:** Full resolve-without-write — richer but out of MUST; defer to later change.
- **Cache:** No requirement to touch download cache; if any read hits cache, must not invent project durable writes. Acceptance: bit-identical project tree.

### D3: Positional classification — zip vs package ref

- **Choice:** If a positional token resolves to an existing path ending in `.zip` (case-insensitive) or is explicitly archive-classified, use archive path (existing). Otherwise treat as package-ref string(s) for add. Multiple package refs allowed; mixing zip + refs in one argv → fail closed.
- **Auto-create:** If no dual-read manifest and package refs present → create minimal `apm.yml` (or brand-consistent `bapm.yml` per dual-read defaults — prefer creating the brand already used by tooling in cwd; default `apm.yml` for APM parity when neither exists). Cheap, documented.
- **Add target:** `dependencies.apm` only (`--dev` out of scope).

### D4: Frozen × positional

- **Choice:** After effective frozen resolution, if package refs present and not dry-run → reject (same spirit as frozen×update). Dry-run + positional → preview would-add, no write (even under CI-default frozen).
- **Keep stricter:** lk-015 tree_sha256, lk-017 deployed hashes, lk-018 CI-default + `--no-frozen` unchanged on non-dry-run frozen path.

### D5: Frozen MCP sync = SHOULD optional, default off

- **Choice:** Document as optional follow-up / default-off opt-in (`enforceMcpFrozenSync` or similar) so CI that relies on pins-only frozen does not break. P6a apply MAY stub or skip implementation; MUST NOT enable fail-closed MCP drift by default.
- **Messaging:** Help/CONFORMANCE soft note: frozen = structure/pins (+ OpenAPM content re-verify); content audit remains `audit --ci`.

### D6: `--exclude` semantics (cursor-only)

- **Choice:** Parse repeatable or single `--exclude <id>`; recognized id `cursor` removes cursor from MCP configure set (skip `configureMcp`). Does not skip `materialize` for skills/rules/agents. Unknown id → UsageError fail-closed.
- **Alternatives:** Exclude as “skip all cursor deploy” — rejected (too broad vs APM MCP/LSP filter spirit for this surface).

### D7: `--parallel-downloads` and `-v`

- **Choice:** Mirror lock command parsing: `--parallel-downloads <n>`, default 4 when unset at CLI (core already optional); `0` = serial. `-v` / `--verbose` set `verbose: true`. Pass through to `runInstall`.

### D8: Preview UX surface

- **Choice:** Core returns structured diagnostics / result fields enough for CLI to print APM-like “would install / would add / policy / no changes made”. Exact formatting is CLI concern; acceptance checks no writes + flag parse + exit codes.

## Risks / Trade-offs

- [Positional path vs org/pkg ambiguity] → Prefer: existing file path ending `.zip` = archive; otherwise package ref; invalid archive layout already fail-closed.
- [Auto-create surprise] → Document in help; only when positional present.
- [Accidental cache as “write”] → Acceptance scopes project tree; document any cache reads.
- [MCP sync default-on would break CI] → Default off (D5).
- [`--exclude` user confusion] → Help: filters MCP configure, not full install.

## Migration Plan

1. Ship flags as additive; existing scripts without new flags unchanged.
2. No lock schema migration.
3. Rollback: revert change; no data migration.
4. Optional MCP frozen sync only behind explicit opt-in if implemented later.

## Open Questions

- None blocking; richer dry-run resolver deferred; MCP sync implementation timing left to apply as default-off SHOULD.
