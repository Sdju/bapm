## Context

See `proposal.md` — Why. bapm already materializes packages under `apm_modules/` (`APM_MODULES_DIR`; `bapm_modules` deferred), validates portable Agent Plugins via `packages/core/.../AgentPlugins/`, and ships `@b-apm/integration-copilot` for `.github/` / `.agents/` / home MCP. Upstream APM 0.29 documents Copilot-native registration as a **whole-plugin** projection: owned catalog + ledger under `apm_modules/.github/plugin/`, merge into `.github/copilot/settings.local.json`, live load from modules (Copilot CLI ≥1.0.81), explicitly **no** private copy and **no** `--plugin-dir`, and **no** loose skill/MCP decompose for that target.

## Goals / Non-Goals

**Goals:**

- Project-scope registration matching APM’s documented projection shape (`marketplace.json`, `apm-registration.json`, `extraKnownMarketplaces.apm`, `enabledPlugins["…@apm"]`).
- Install orchestration hook when `copilot` is effective; skip loose Copilot projection for admitted portable roots.
- Fail-closed admission / settings / collision rules; lifecycle retire on uninstall/prune.
- Docs + compatibility matrix row; fixture-level tests (no real Copilot binary in CI).

**Non-Goals:**

- Global `-g` / `$COPILOT_HOME/settings.json` registration.
- Renaming `--agent-plugins` → `--format agent-plugin`.
- Invoking or pin-testing Copilot CLI; canvas; trust-bin / exclusive skills (done).

## Decisions

### D1: Modules root stays `apm_modules`

- **Choice:** Keep `APM_MODULES_DIR = "apm_modules"` as the only modules root for catalog paths and settings `path: "apm_modules"`.
- **Why:** Existing wire parity; APM Copilot docs hard-code this directory name for live load.
- **Alternatives:** Brand `bapm_modules` — rejected for this slice (deferred alias).

### D2: Wire-compatible marketplace namespace `apm` / `@apm`

- **Choice:** Use marketplace id `apm` and enable suffix `@apm`, ledger filename `apm-registration.json`, matching APM’s documented projection.
- **Why:** Copilot settings schema is marketplace-id agnostic, but matching APM avoids dual conventions in shared checkouts and keeps docs/fixtures aligned with upstream.
- **Alternatives:** Brand `bapm` / `@bapm` / `bapm-registration.json` — deferred; would still be valid Copilot JSON but splits parity.

### D3: Core-owned registrar; integration stays free of reverse core dep

- **Choice:** Implement registration (catalog/ledger/settings merge + collision rules) in `@b-apm/core` (Install and/or a thin helper next to AgentPlugins), invoked from install/uninstall/prune. `@b-apm/integration-copilot` only skips loose materialize for package roots marked admitted/native-registered (signal from install orchestration / primitive metadata)—no static import of integration from core.
- **Why:** Same boundary as other install-owned sidecars; preserves “core MUST NOT hard-depend on integration-copilot”.
- **Alternatives:** Put registrar inside integration-copilot and call via capability hook — possible later; heavier for lifecycle/uninstall which already lives in core.

### D4: Admission = portable Agent Plugins root + Copilot effective + gates

- **Choice:** Admit when package root has valid portable `plugin.json` (existing AgentPlugins load/validate), Copilot is in the effective target set, and integrity/security/executable gates that already apply to the install succeed. Non-portable / invalid roots that claim the native path fail closed—no copy/`--plugin-dir` fallback.
- **Why:** Matches APM “canonical Agent Plugin” admission and parent fail-closed criterion.
- **Alternatives:** Soft-skip invalid plugins with diagnostic only — rejected (criteria require fail-closed).

### D5: Skip loose Copilot projection per admitted package

- **Choice:** After discovering portable primitives, when building the Copilot deploy set, omit skill/MCP (and other whole-plugin-covered) primitives whose `packageName`/`pluginRoot` is admitted for native registration. Other hosts in a multi-target install still receive their projections.
- **Why:** APM explicitly avoids double-load on Copilot.
- **Alternatives:** Disable all portable discovery when Copilot-only — too broad; breaks Cursor+Copilot combo installs.

### D6: Catalog plugin path shape

- **Choice:** Catalog entries point at the real materialized package directory under `apm_modules/` (resolver layout already used by download/lock), using repository-relative paths consistent with settings `path: "apm_modules"`. Exact `marketplace.json` plugin object fields follow Copilot/Claude-compatible marketplace plugin entries (name + directory/source pointing at the package path)—implement against fixtures derived from APM docs / agent-plugins fixtures.
- **Why:** Live load needs a real on-disk plugin root with `plugin.json`.
- **Alternatives:** Flatten-copy into `apm_modules/.github/plugin/<name>/` — rejected (APM keeps package in modules; no copy).

### D7: Authoring flags unchanged

- **Choice:** Keep `pack` / `plugin init` `--agent-plugins`; do not add `--format agent-plugin` in this slice.
- **Why:** Existing flag already produces portable roots required for admission; rename is non-blocking follow-up.

### D8: Project scope only

- **Choice:** Only `.github/copilot/settings.local.json` + project `apm_modules/`. No `$COPILOT_HOME` writes.
- **Why:** Parent slice is install→copilot project registration; global is listed as follow-up.

## Risks / Trade-offs

- [Ledger/settings merge vs user JSONC] → Fail closed on invalid JSON; document plain JSON requirement (APM parity).
- [Shared repo with hand-edited `extraKnownMarketplaces.apm`] → Ownership collision fail-closed; matching path re-adopt.
- [Multi-target double semantics] → Copilot skips loose projection; Cursor/OpenCode still materialize—document clearly.
- [No real Copilot CLI in CI] → Fixture assert catalog/ledger/settings shape; docs state ≥1.0.81 for live load.
- [Uninstall without full reinstall] → Rebuild projection from remaining admitted set (same as install rebuild) to avoid stale `@apm` keys.

## Migration Plan

- No lockfile format bump.
- First Copilot install with portable plugins creates registration files; users grant Copilot folder trust once (not pre-seeded).
- Rollback: stop writing registration; leave settings keys for manual cleanup if needed (document).

## Open Questions

None — projection paths, modules dir, marketplace id, and project-scope boundary locked to APM 0.29 docs + parent criteria.
