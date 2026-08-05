## Context

See proposal.md — Why. Baseline: core `packages/core/src/modules/Doctor/runDoctor.ts` checks git (critical), manifest/lock if present (critical on parse fail), modules dir sanity; text lines `PASS|FAIL\tname\tmessage`; no `verbose` on `RunDoctorOptions`. CLI `packages/cli/src/modules/Doctor/services/runDoctor.ts` `parseDoctorArgs` only allows `-h`/`--help`; any other `-…` → `Unknown doctor flag`. Criteria: `.samples/apm-knowledge/topics/p7f-doctor-verbose-criteria.md`. APM top-level doctor wraps marketplace doctor; bapm must enrich project domains only.

## Goals / Non-Goals

**Goals:**
- Wire CLI `-v`/`--verbose` → core `verbose` with richer messages for git/manifest/lock/modules.
- Keep critical exit semantics and fail-closed unknown flags.
- Ship SHOULD thin network (informational or verbose-only) + auth-env informational without marketplace rows.

**Non-Goals (design-level):**
- No marketplace.yml / format / duplicate / version-alignment / executable-trust checks.
- No `AuthResolver` / `gh` CLI required dependency; no CONFORMANCE edits; no `--global` doctor.

## Decisions

### D1 — CLI parse allowlist for verbose

**Choice:** In `parseDoctorArgs`, accept `-v` / `--verbose` → `{ verbose: true }`; keep `-h`/`--help`; any other `arg.startsWith("-")` → `Unknown doctor flag: ${arg}`. Pass `verbose` into `coreRunDoctor({ cwd, verbose })`. Update `formatDoctorHelp` to list `-v, --verbose`.

**Rationale:** Mirrors install/lock local parsers; minimal blast radius; closes G1.

**Alternative:** Shared argv framework — deferred.

### D2 — Enrich messages in-place (same four check names)

**Choice:** Keep four check names (`git`, `manifest`, `lockfile`, `modules`). When `options.verbose`, expand `message` with concrete detail (do not invent a second output format). Default messages stay compact. Still emit tab-separated `PASS|FAIL\tname\tmessage` lines.

**Rationale:** Criteria MUST 3–4; stable machine-friendly prefix for tests (SHOULD S4).

**Alternative:** Extra verbose-only lines per domain — optional later; prefer single enriched message first.

### D3 — Git verbose detail from `git --version`

**Choice:** Extend `probeGit` (or sibling) to capture stdout when probing; on verbose PASS include trimmed version string; on FAIL include miss/timeout reason. Honor existing test hooks (`gitAvailable` / `hasGit` / `whichGit` / `findGit`) — when mocked boolean, verbose message may say availability without spawning.

**Rationale:** G3; mirrors APM detail lightly without marketplace coupling.

### D4 — Manifest / lock / modules verbose fields

**Choice:**
- Manifest present: path (`apm.yml` or `bapm.yml` discovered) + `name@version` from loaded document.
- Lock present: path + `lockfile_version` and `dependencies.length`.
- Modules: `apm_modules` path; if absent → “absent (ok)”; if dir → entry count (non-recursive readdir length is enough); if exists but not dir → keep critical FAIL.

**Rationale:** G4; uses existing Manifest/Lockfile public load APIs.

### D5 — Network SHOULD: verbose-only, informational

**Choice:** When `verbose`, optionally run `git ls-remote https://github.com/git/git.git HEAD` with ≤5s timeout via `spawnSync`. Emit check name `network`, `critical: false`. Skip entirely when not verbose (offline CI default stays fast). Document in help only if shipped.

**Rationale:** Criteria open question — prefer verbose-only so non-verbose doctor never waits on network; never critical (unlike APM).

**Alternative:** Always-on informational — rejected for default latency; critical network — rejected for offline CI.

### D6 — Auth-env SHOULD: informational always or with verbose

**Choice:** Ship as informational check name `auth` (or `auth-env`), `critical: false`, always-on when implemented (cheap env read). Report which of `GITHUB_TOKEN` / `GH_TOKEN` is set by **name only**; never print values. Missing token → ok informational “not set”.

**Rationale:** S2; never affects exit. Always-on is fine (no I/O). Help mentions only if shipped.

**Alternative:** Full APM AuthResolver — out of scope.

### D7 — No second product mode

**Choice:** `verbose` MUST NOT flip criticality of the four domains. Network/auth never critical in this change.

**Rationale:** Truthfulness rule 4; MUST NOT weaken critical-git.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Network flaky in verbose CI | Informational only; timeout bounded; tests mock/skip network |
| Verbose messages brittle in snapshots | Assert substrings (version/path/count), not full golden strings |
| Help lies if probes deferred | Document network/auth in help only when code ships (S3) |
| Double-detail noise for users | Keep one line per check; enrich message text only |

## Migration Plan

None breaking for default doctor. Callers may start passing `-v`. Rollback = reject `-v` again (not desired). No lockfile/manifest schema migration.

## Open Questions

- None blocking — D5/D6 lock the SHOULD defaults (network verbose-only informational; auth-env informational, no secrets).
