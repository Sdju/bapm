## Why

After OpenAPM floor (S1–S5 / P1–P5), install still lacks APM CLI ergonomics users expect: `--dry-run` preview, positional package-ref add into the manifest, and thin flags (`--parallel-downloads`, `-v`/`--verbose`, `--exclude`). Closing this APM UX gap (P6a) without weakening OpenAPM integrity (lk-015/017/018) or teaching targets about dry-run.

## What Changes

- Add **core/API `dryRun`** on install orchestration: when set, zero durable project writes (no materialize, configureMcp, lock/manifest write, orphan delete, archive extract); targets stay write-only ports with **no** `dryRun` knowledge.
- Default dry-run preview aligns with APM: direct deps + policy preflight on directs; **no** full resolver/download unless a later design explicitly opts in (out of P6a MUST).
- Positional **non-zip** package refs: validate → add to `dependencies.apm` → continue install; disambiguate from `.zip` archive path; auto-create minimal `apm.yml`/`bapm.yml` when missing and positional is present (APM parity, cheap).
- Reject effective frozen (incl. CI-default) × positional manifest mutation; dry-run + positional = preview would-add without write.
- Wire CLI `--parallel-downloads`, `-v`/`--verbose`, `--exclude` (cursor-only: `--exclude cursor` skips `configureMcp`, warn + continue package path).
- Soft frozen align: keep lk-015/017/018 stricter; optional SHOULD MCP config/inventory sync in design without making it CI-breaking MUST.
- Help/docs note new flags and frozen structure vs content integrity messaging.

**Non-goals / scopeOut:** multi-target; MCP-without-`.cursor/` mkdir policy change; `--only`/`--force`/`--mcp` add/`--global`/`--dev`/heal; full dry-run+resolver; weakening integrity; P6b+.

## Capabilities

### New Capabilities

- _(none)_ — behaviour extends existing install/CLI/MCP/target surfaces.

### Modified Capabilities

- `install-pipeline`: dry-run zero-write orchestration at core boundary; positional package-ref add (+ auto-create manifest); frozen×positional reject; `--exclude` gating of MCP configure; optional SHOULD frozen MCP sync documented as non-blocking default.
- `cli-runtime-surface`: expose `--dry-run`, positional package refs (vs zip), `--parallel-downloads`, `-v`/`--verbose`, `--exclude`; update install help.
- `cursor-mcp-deploy`: when install excludes cursor from MCP target set, skip `configureMcp` / `.cursor/mcp.json` writes while package materialize may still run.
- `target-api-contracts`: `BapmTarget` / materialize / configureMcp MUST NOT grow a `dryRun` parameter; dry-run is core/orchestrator-only.

## Impact

- `@bapm/core` Install: `dryRun` option, early preview path, positional add / auto-create manifest helpers, exclude set for MCP, optional MCP sync SHOULD behind explicit flag or deferred default-off.
- `bapm` CLI Install: parse/help/run wiring for new flags and package refs.
- `bapm-target-api` / `bapm-target-cursor`: **unchanged** dry-run surface (no adapter branches).
- Acceptance/unit tests per DoD in criteria; CONFORMANCE/help soft notes only (no claim-table churn required).
- Follow-on: P6b+ audit/SBOM/policy-status — out of this change.
