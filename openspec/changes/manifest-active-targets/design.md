## Context

See `proposal.md` for motivation. Today host activation is: CLI `--target` / `forceTarget` → sole `registry.detect(cwd)` → fail (“missing or ambiguous”). Manifest `target` / `targets` (string | array | object-map) feed declared preference, intersection (`declaredTargetIds`), and optional dynamic integration load — they do **not** pick the active host. Core install already materializes via `activeTargets: string[]` and loops each id, but selection still collapses to a single forced/detect id (`options.activeTargets` override currently rejects length ≠ 1). Compile is single-host. Object-map load runs in the CLI composition root before selection (`target-integration-dynamic-load`).

OpenAPM v0.1 does not define a top-level `active` field; this is a **bapm extension** (same posture as object-map values and `local:`), dual-read on `bapm.yml` / `apm.yml`. No hard OpenAPM conflict: mutual exclusion `target`↔`targets` (tg-008) and mf-005 tokens remain unchanged.

## Goals / Non-Goals

**Goals:**

- First-class `active: [<id>, …]` on the project manifest selecting which registered hosts to materialize.
- Ordered selection: force `--target` → non-empty `active` → sole detect → fail-closed.
- Multi-id `active` for install/MCP; compile stays single-selected.
- Fail-closed empty list and unknown/unregistered ids (after map load).
- Docs: config-manifest + install (and compile) guidance.

**Non-Goals:**

- Auto-activating hosts from object-map keys alone.
- `--target all` or multi-file compile from multi-`active`.
- Changing intersection math beyond feeding selected active ids into the existing filter.
- Claiming `active` as OpenAPM-required vocabulary.

## Decisions

### D1: Field shape — `active` as non-empty string array

- **Choice:** Top-level `active:` MUST be a YAML sequence of non-empty mf-005 tokens (canonical / alias / `x-<vendor>-<name>`). Retain on `BapmManifest`. Reject wrong types, empty strings, invalid tokens, and **empty arrays** at parse/validate.
- **Why empty fails closed:** Presence of `active` declares activation intent; `[]` is almost always a misconfiguration. Omitting the key preserves detect/`--target` paths. “Skip all materialize” is already available by not selecting any host when detect fails and no force/`active` (modules+lock may still succeed depending on command path — install selection today fail-closes without a target; do not use `active: []` as a silent no-op).
- **Alternatives:** Treat `[]` as skip materialize — rejected (silent footgun). Allow scalar `active: cursor` — rejected for v1 to keep one shape and match user proposal.

### D2: Selection priority

1. CLI `--target` / core `forcedTarget` | `forceTarget` — single forced id; ignores detect and ignores manifest `active` for that run.
2. Else if manifest `active` is present and non-empty (post-parse it always is if present) — use that list (order preserved; dedupe consecutive/all duplicates to unique preserving first-seen order).
3. Else auto-detect: exactly one detected registered id → that id.
4. Else fail-closed with guidance mentioning `--target <id>` and/or setting `active:` in the manifest.

Programmatic `options.activeTargets` (if kept) MUST follow the same multi-capable semantics as manifest `active` when used as an explicit override **below** force, or be reserved for tests injecting the resolved list — implementers MUST NOT leave the current “length must be 1” trap for the manifest path.

### D3: Multi-active for install; single for compile

- **Install / MCP:** Materialize (and configure MCP when eligible) **each** registered id in the resolved active list, subject to existing intersection, exclude, only-mode, and dry-run rules. Fail closed if **any** id is unregistered after built-in + map load (no partial materialize of the known subset).
- **Compile:** Remains one host per invocation. If force is set → that id. Else if `active` has exactly one compile-capable registered id → use it. Else if `active` has multiple ids → fail closed asking for `--target <id>` (do not invent multi-compile). Else detect / fail as today.
- **Why not v1-only-single for install:** Core already loops `activeTargets`; product ask is multi-materialize. Restricting install to one element would under-serve multi-host maps.

### D4: Separation from `target` / `targets`

| Field | Role |
| --- | --- |
| `active` | Which host ids to **activate** this run (materialize/MCP; sole for compile) |
| `target` / `targets` | Declared preference / intersection keys; object-map → package/path to **load/register** |

Map load still runs before selection. Map keys alone still do not activate. `active` ids need not equal map keys when the id is already built-in (e.g. `cursor`). If `active` names an id that is neither built-in nor map-bound → fail-closed diagnostic naming the id.

Intersection: unchanged — `declaredTargetIds` still from `target`/`targets` only. When root declared is empty, consumer auth falls back to the current active id (existing behavior). When declared is non-empty and omits an active id, that host may materialize with empty filtered primitives — do not auto-merge `active` into declared preference in v1 (avoids conflating fields). Docs SHOULD recommend `active` ⊆ declared when both are set.

### D5: Where selection reads the manifest

- **Choice:** Core install/compile orchestration reads `active` from the already-loaded project manifest document (same dual-read discovery as today). CLI continues to force via `--target` and to load object-map integrations before calling core.
- **Why:** Avoids duplicating manifest discovery in CLI solely for `active`; keeps selection policy in one place next to detect/force.
- **Alternative:** CLI parses `active` and passes `activeTargets` option only — acceptable equivalent if core still enforces validation and priority; prefer core-owned read for one source of truth.

### D6: Docs and help

Update VitePress `guide/config-manifest`, install situation/reference, and compile help text: selection is `--target` → `active` → detect → fail. Clarify that object-map still does not activate. Dual-read note for `apm.yml`.

### D7: OpenAPM / conformance posture

Document `active` as bapm extension in docs/boundary language if touched; do not flip OpenAPM checklist rows. Unknown-field round-trip: once first-class, serialize `active` like other known fields.

## Risks / Trade-offs

- [Multi-active install changes historical “one active host” mental model] → Document clearly; compile stays single; `--target` still forces one.
- [Intersection empty when `active` ⊄ declared] → Document SHOULD alignment; keep fields separate rather than silently expanding declared.
- [Authors set only `active` without map for custom hosts] → Same fail-closed as unknown `--target`; map or built-in still required for registration.
- [Older docs / architecture pages say “`--target` → detect → fail”] → Update in this change’s doc tasks.

## Migration Plan

1. Parse/validate `active`; unit tests.
2. Wire selection in install (+ MCP) and compile; adjust override length check.
3. CLI help + VitePress docs.
4. Acceptance covering: sole `active`, multi install, force wins over `active`, empty reject, unknown id, dual-read `apm.yml`, compile multi-`active` fails without `--target`.

Rollback: revert the change; manifests with `active` would again be retained as unknown top-level keys if parse stops recognizing them — prefer documenting removal before rollback on published projects, or keep parse accepting-but-ignoring only if a hotfix is needed (not planned).

## Open Questions

None blocking; deferred polish only: whether producer `init --target` should also write `active: [<id>]` (out of scope unless a follow-up).
