## Why

APM 0.28.0 (#2166) lets registry object-form dependencies (`- id: owner/repo`) declare consumer-side `skills:` / `targets:` subset-install, matching git-longhand, and serializes them back as object-form instead of collapsing to a git string (OpenAPM req-mf-024). bapm already allowlists those meta keys on parse (`DEP_META_KEYS`, `skills?: unknown`) but never validates or consumes them in Resolver/Install, so a registry longhand entry still deploys the whole package and a structured rewrite can lose `id:` identity.

## What Changes

- Parse and fail-closed-validate object-form `skills:` and `targets:` on APM dependency entries (non-empty string lists; skill names without traversal; target tokens via existing mf-005 `isValidTargetToken`). Shared helper so git object-form (`git:`) uses the same grammar as registry `id:` (git-longhand subset is **not** already consumed today).
- Thread the validated subsets through classify / resolve nodes so install can see them.
- Materialize only the requested skill names and only onto the intersection of active install targets with the per-dep `targets:` subset. Omitted fields still mean “all”. A persisted skill subset that matches nothing MUST warn (req-mf-022) rather than silently deploying zero skills with no diagnostic.
- Round-trip YAML as object-form: `serializeManifest` / producer write / structured dependency merge MUST keep `- id:` / `- registry:` entries as dicts with `id` (and optional `skills` / `targets`), NEVER rewrite them to `git:` or a canonical git string (req-mf-024).
- Document the fields on the user-facing dependencies guide.
- Mode B: claim **req-mf-024** with a real citation once the identity-preservation tests exist.

This is the **first slice** of APM 0.28–0.30 parity, not the whole roadmap.

### Non-goals (this change)

- `.bapmignore` (already shipped).
- `--trust-bin`, exclusive plugin-manifest `skills:`, Copilot native Agent Plugins, `pack --check-versions` + `plugin.json`, req-pl-018, Hermes, grok-cloud, Homebrew/`install.sh`, gh-aw.
- CLI `--skill` / `--skill '*'` persistence (APM skill-bundle CLI from #974). YAML `skills:` on object-form deps is in scope; the flag is not.
- Expanding `CANONICAL_TARGET_TOKENS` with `kiro` / `grok-build` (mf-005). Those runtime packages already exist; dep-level `targets:` uses the current token helper, so this slice is not blocked. `targets: [kiro]` remains invalid until a later identity slice.
- Dedicated path-form serialize fix (APM #1987). Shared parse may validate `skills`/`targets` on `path:` objects, but path→git collapse is not a success criterion here.

### Follow-ups (not tasks of this change)

1. `install-trust-bin`
2. `plugin-skills-declaration-exclusive`
3. `copilot-native-agent-plugins`
4. `pack-check-versions-plugin-json`
5. `policy-canonical-identity-casing`

## Capabilities

### New Capabilities

- `deps-object-subset`: Consumer-side `skills:` / `targets:` subset on object-form APM deps (registry `id:` as the #2166 bar; git object-form via the same helper), install materialize of only that subset, and object-form identity preservation on serialize/merge (req-mf-024).

### Modified Capabilities

- `manifest-yaml-validate`: Validate `skills:` / `targets:` shape on object-form dependency entries (empty list, non-strings, traversal, unknown target tokens fail closed); retain typed lists on the document.
- `dependency-resolve`: Classify/resolve MUST carry `skillSubset` / `targetSubset` from object-form declarations onto classified/resolved nodes (no fetch-time narrowing; full package still downloads).
- `install-pipeline`: After discover, filter primitives by per-dep skill subset and compose per-dep `targets:` with existing package/consumer intersection; warn on empty skill-subset match (req-mf-022). Structured rewrite of an existing `id:` entry MUST refuse silent conversion to `git:`.
- `openapm-conformance-statement`: Add active consumer **req-mf-024** with in-repo citations; keep req-mf-022 citations honest for the empty-subset diagnostic.

## Impact

- `@b-apm/core` Manifest parse/types/serialize; Resolver classify + `ResolvedNode`; Install primitive filter and any package-ref / structured-dep merge (`packageRefs` / producer write).
- `apps/docs` guide for `dependencies.apm` object-form (`manifest-dependencies.md`); optional install/reference callout that YAML `skills`/`targets` apply to `- id:` as well as `- git:`.
- `CONFORMANCE.md` / Mode B checklist for req-mf-024.
- No new CLI flags, no new workspace packages, no FEOD CLI module. Acceptance tests land in later orchestration phases.
