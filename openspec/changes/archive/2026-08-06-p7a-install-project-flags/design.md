## Context

See proposal.md — Why. Baseline after P6a: CLI leftovers rejected as unknown; core install options lack force/insecure/dev/only/refresh; Manifest parses `allow_insecure` + `devDependencies` but resolve uses only `dependencies.apm`; cursor materialize always overwrites; no shared APM content cache. Criteria: `.samples/apm-knowledge/topics/p7a-install-project-flags-criteria.md`; deep-dive: `command-deep-dive-install.md`. APM mirrors: `install.py`, `insecure_policy.py`, `InstallMode`.

## Goals / Non-Goals

**Goals:**

- Wire CLI+core for `--force`, `--allow-insecure`, `--allow-insecure-host`, `--dev`, `--only apm|mcp`.
- Fail-closed dual-consent HTTP + transitive host allowlist (APM intent).
- `--dev` write + root resolve include `devDependencies.apm`.
- `--only` skip MCP vs skip APM materialize.
- Document `--force` semantics without frozen/policy/ref refresh bypass; omit untruthful `--refresh`.

**Non-Goals:**

- Protective collision-skip (APM default) in this slice.
- Full install-time unicode/security scanner for force security-half.
- Shared git/http cache or APM `--refresh` fidelity.
- `--global`, multi-target, `--mcp` CLI add, CONFORMANCE claim churn.

## Decisions

### D1: Cursor collision — keep always-overwrite; `--force` collision half N/A

- **Choice:** Do **not** add APM skip-on-different-content in p7a. Cursor materialize stays overwrite. Accept `--force` for CLI/help parity and a thin future security-gate hook; document collision half as N/A.
- **Alternatives:** (a) Implement protective skip + force overwrite in same slice — more APM-faithful but expands materialize/target behavior and acceptance surface beyond MUST minimum; (b) Reject `--force` until skip exists — violates MUST “still accept the flag.”
- **Rationale:** Criteria explicitly allow documenting N/A collision when product keeps always-overwrite; avoids target churn and fake “force did something” for collision.

### D2: Omit `--refresh` (DEFER)

- **Choice:** Do not parse, help-list, or implement `--refresh` in p7a.
- **Alternatives:** (a) Thin “re-resolve + re-download modules” without claiming cache bypass — risks user confusion vs `--update` and still isn’t APM cache semantics; (b) Alias to `--update` — untruthful.
- **Rationale:** No shared content cache; `--update` already covers mutable re-resolve; criteria prefer omit over lie.

### D3: Insecure policy as core gate before fetch

- **Choice:** Add a small core helper (APM `insecure_policy` intent) invoked from install after resolve identifies HTTP URLs / graph parents, before download. Classify `http://` as insecure; enforce dual consent on **direct** roots; build transitive host allowlist from CLI hosts + hosts of approved directs when `--allow-insecure`.
- **Hostname validation:** Fail closed at CLI parse (and core if called directly) for non-FQDN / invalid tokens; normalize lower-case.
- **Alternatives:** CLI-only check — rejected (API callers need same gate).

### D4: `--dev` write bucket + resolver union at root only

- **Choice:** Extend package-ref append helper with `dev?: boolean` → `devDependencies.apm`. Change `resolveGraph` root `listApmDeps` to union `dependencies.apm` + `devDependencies.apm`. Child walks stay `dependencies` only.
- **Without positional:** `--dev` is no-op (optional warn); no side effects.
- **Pack:** Verify pack already ignores undeclared / filters dev; no CONFORMANCE churn; do not block p7a on pack edits unless broken.

### D5: `--only` as install mode enum

- **Choice:** Core option `only?: "apm" | "mcp"` (or `installMode`). `apm` → skip `configureMcp` (same effect channel as exclude-cursor for MCP writes). `mcp` → skip APM modules download/materialize / primitive materialize for packages; still allow MCP configure + existing lock MCP restoration paths that do not require re-materializing APM trees.
- **Alternatives:** Reuse `--exclude` for only-apm — rejected (different product flag; `--exclude` is runtime filter, not InstallMode).
- **Compose:** `--only apm` + `--exclude cursor` both skip MCP (idempotent). Unknown only values fail at CLI.

### D6: `--force` option plumbing without behavior inflation

- **Choice:** `force?: boolean` on core options; CLI accepts/forwards. No ref refresh; no frozen bypass; no `--no-policy` implication. No new scanner; if a pre-existing critical gate is found later, force MAY bypass it in a follow-up — not required to invent one here.
- **Naming:** Keep `forcedTarget` / `--target` distinct in types and help.

### D7: Options surface (core)

- **Choice:** Extend `RunInstallOptions` / Install types with: `force`, `allowInsecure`, `allowInsecureHosts: string[]`, `dev`, `only?: "apm" | "mcp"`. No `refresh`.
- CLI parse mirrors Click: repeatable hosts; `--only` choice; leftovers still unknown.

## Risks / Trade-offs

- [Users expect APM collision skip] → Mitigate: help + design/docs state always-overwrite; force N/A for collision until a later change.
- [Users expect `--refresh`] → Mitigate: omit flag; help must not claim it; follow-up when modules re-fetch story is crisp.
- [HTTP classification edge cases (git+http, redirects)] → Prefer scheme on declared/resolved fetch URL; document fail-closed for clear `http://`; tighten in apply if fixtures show gaps.
- [`--only mcp` vs lock/hash expectations] → Preserve frozen/policy on remaining work; skip only APM materialize; acceptance fixtures define observable skips.
- [devDependencies in resolve surprises pack/CI] → Root-only union; verify pack exclusion; no claim-table edits.

## Migration Plan

1. Additive flags; existing invocations unchanged.
2. Projects with HTTP deps that previously installed without dual consent will start failing — intentional fail-closed; remediation matches APM.
3. Projects that listed unused `devDependencies.apm` will begin installing them on bare install — intentional APM parity; remove or move entries if undesired.
4. Rollback: revert change; no lock schema migration.

## Open Questions

- None blocking. Security-half force bypass waits on a real install-time critical gate (out of p7a). Protective collision-skip deferred to a later slice if product wants full APM default.
