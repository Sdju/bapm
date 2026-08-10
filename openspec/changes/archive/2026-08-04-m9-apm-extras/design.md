## Context

See `proposal.md` for motivation. Post-M8: install materializes cursor skills/rules/agents; lock already preserves `mcp_*` keys on serialize but target-cursor **never** writes `.cursor/mcp.json`; no `compile` / `cache` CLI. Normative acceptance: `.samples/apm-knowledge/topics/m9-apm-extras-acceptance.md`. FEOD: core library modules + CLI thin commands. Packages: `@b-apm/core`, `@b-apm/cli`, `bapm-target-cursor` (+ optional `bapm-target-api` contract). Cursor-only — no new `bapm-target-*`.

## Goals / Non-Goals

**Goals:**

- Cursor MCP on install → `.cursor/mcp.json` + lock `mcp_*` + detect honesty
- sc-009 fail-closed when grant surface present; manifest-authored grants sufficient
- Thin `compile` → `AGENTS.md` (cursor); thin `cache info|clean`
- Optional host-agnostic MCP configure on `bapm-target-api`; cursor implements
- Keep dual-read and M3–M8 paths green without MCP deps

**Non-Goals (design-level):**

- Marketplace, plugin init, multi-host compile, shared APM git/http cache
- `run` / runtime / config / experimental / find / view; publish / self-update (M10)
- Full interactive approve UX parity as MUST (CLI is SHOULD)
- Claiming a new OpenAPM conformance class solely from M9

## Decisions

### D1: MCP configure via target-api optional hook; cursor implements

- **Choice:** Extend `bapm-target-api` with an optional `configureMcp` (name flexible) / capability on the registered target; `bapm-target-cursor` writes `.cursor/mcp.json`. Core Install calls through registry only.
- **Why:** Keeps core free of cursor imports; acceptance recommends api-neutral hook.
- **Alternatives:** Private cursor-only API called from CLI — rejected (bypasses install orchestration / lock inventory).

### D2: Direct-only MCP by default; `--trust-transitive-mcp`

- **Choice:** Deploy only direct `dependencies.mcp` unless `--trust-transitive-mcp` (APM-like).
- **Why:** Matches acceptance open question recommendation; fail-safe default.
- **Alternatives:** Always deploy transitive — rejected (trust surface too wide).

### D3: Grant vocabulary — prefer `executables.allow`, alias `allowExecutables`

- **Choice:** Primary wire form `executables: { allow, deny }` (APM approve.py); accept `allowExecutables` as documented alias for OpenAPM text drop-in.
- **Why:** Dual-read consumers may use either; one preferred form for docs/fixtures.
- **Alternatives:** Only OpenAPM camelCase — weaker APM drop-in.

### D4: sc-009 gate in core before MCP write; approve CLI SHOULD later

- **Choice:** Core `ExecutableTrust` (or Install submodule) evaluates grants before configureMcp. Manifest YAML grants enough for MUST. Thin `approve`/`deny` + user-local store (sc-010) and deny-wins vs M8 policy (sc-011) as optional/later tasks.
- **Why:** Pass bar does not require CLI; gate is mandatory when MCP ships.
- **Alternatives:** Defer entire trust until approve CLI — rejected (acceptance MUST with MCP).

### D5: Compile is AGENTS.md-only; reuse Primitives discovery

- **Choice:** Core `Compile` module: discover via existing Primitives → emit `AGENTS.md`. No refresh of `.cursor/rules`. `--validate` SHOULD; watch deferred. Constitution/build-id SHOULD if cheap.
- **Why:** Acceptance recommends AGENTS-only; rules stay install materialize.
- **Alternatives:** Full APM multi-target compilation — violates cursor-only freeze.

### D6: Cache CLI over project modules root, not shared ~/.bapm/cache

- **Choice:** `cache info|clean` operate on the same modules-cache root resolve/install use (`apm_modules` or documented equivalent). No APM shared git/http cache in M9. `prune --days` optional later.
- **Why:** Sufficient for MUST; avoids new cache identity semantics.
- **Alternatives:** Introduce `~/.bapm/cache` now — defer (open question).

### D7: FEOD module split

- **Choice (core):** directory modules e.g. `Mcp` (collect + lock mcp_* helpers), trust helpers, `Compile`, `Cache`; Install orchestrates order: policy → … → trust → configureMcp → lock mcp_*.
- **Choice (CLI):** `commands/compile`, `commands/cache` (+ optional `mcp` / `approve` / `deny`); modules thin adapters; register in `app`.
- **Why:** Locked FEOD profile; mirrors M8 Policy pattern.

### D8: Ownership of mcp.json keys

- **Choice:** Idempotent overwrite of bapm-owned server keys (keyed by server name / provenance); preserve unknown user keys when inexpensive; document thinly.
- **Why:** Acceptance allows thin ownership docs.
- **Alternatives:** Full merge provenance graph — defer.

## Risks / Trade-offs

- [Existing tests assert “never mcp.json”] → Update cursor unit tests/README as part of apply; keep “no MCP deps ⇒ no mcp.json required”.
- [Grant alias ambiguity] → Document one primary form in help/fixtures; accept alias in parser.
- [sc-011/012 incomplete] → MUST bar = sc-009; wire deny-wins/require diagnostics as SHOULD tasks.
- [Compile determinism flaky] → Prefer stable sort of primitives; build-id section if timestamps tempt drift.
- [Clean deletes modules mid-work] → Require `-y`/confirm; document re-resolve after clean.

## Migration Plan

1. target-api optional MCP configure + cursor writer (feature-flagged behind install call).
2. Core trust gate + MCP collect; wire install after policy.
3. Lock `mcp_*` populate on write-back.
4. `compile` + `cache` core + CLI.
5. Optional SHOULD: `mcp` / `approve`/`deny`, prune, sc-011/012.
6. Regression: dual-read, no-MCP install, M8 policy still before durable writes.
7. Rollback: omit MCP configure call / leave grants absent ⇒ prior behavior; no lock schema break (fields already known).

## Open Questions

- Exact confirm UX for `cache clean` without `-y` (stdin prompt vs require `-y` only in CI) — implementer choice if non-interactive refuse is clear.
- Whether sc-009 withhold is always non-zero exit vs success-with-diagnostic — prefer non-zero or explicit fail-closed when grant surface present and any MCP withheld; fine-tune in apply against acceptance tests.
