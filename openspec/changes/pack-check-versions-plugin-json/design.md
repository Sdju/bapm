## Context

See `proposal.md` for motivation. Today `bapm pack` supports `--archive`, marketplace emit, `--agent-plugins`, and `--check-release` (pr-004). Marketplace authoring already loads `versioning` as opaque `unknown`. APM implements `--check-versions` in `marketplace/version_check.py` with `_read_local_version` (`apm.yml` then `plugin.json` via `find_plugin_json`). bapm has no equivalent gate; Agent Plugins load only canonical root `plugin.json`, which is narrower than APM’s multi-location finder used by the version gate.

## Goals / Non-Goals

**Goals:**

- Core pure helper: read local package versions + evaluate strategies; CLI flag wiring; docs/help.
- Dual-read `bapm.yml`/`apm.yml` authoritative; `plugin.json` fallback with APM location order and fail-closed rules.
- Keep gate orthogonal to `--check-release` and to M7 zip success when the flag is absent.

**Non-Goals:**

- `--check-clean`, pack `--json` envelope, doctor version-alignment rows, renaming `--agent-plugins`.

## Decisions

### D1: New core module next to Pack / Marketplace, not inside checkRelease

- **Choice:** Implement `checkVersionAlignment` (name flexible) under Marketplace (Authoring/PackOutputs-adjacent) or Pack as a dedicated helper; export from `@b-apm/core` public API. Do **not** overload `checkReleaseTag`.
- **Why:** Different inputs (marketplace local packages vs git tag↔root manifest) and different exit semantics; avoids conflating pr-004 with marketplace versioning.
- **Alternatives:** Fold into `checkRelease.ts` — rejected (user/roadmap: do not confuse flags).

### D2: Version source = Manifest dual-read, then APM plugin.json locations

- **Choice:** At each local package root: if `bapm.yml` or `apm.yml` exists (Manifest discover rules; both present → fail closed like project dual-read), load YAML and take string `version`. Else scan `plugin.json` candidates in APM order: `<root>/plugin.json`, `.github/plugin/plugin.json`, `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`. Cap read size at 1 MiB; reject symlink/non-file; require printable ASCII version for plugin.json path.
- **Why:** Matches #2454 + dual-read bapm identity; AgentPlugins’ root-only rule stays for portable AP load, but the version gate needs APM collection locations.
- **Alternatives:** Only root `plugin.json` — weaker APM parity; only `apm.yml` — breaks bapm.yml packages.

### D3: Prefered manifest present ⇒ no plugin.json fallback

- **Choice:** Any existing preferred YAML path that fails parse / missing version / non-regular file fails the package row; never consult plugin.json in that case.
- **Why:** APM explicit fail-closed; prevents silent drift when authors keep a broken `apm.yml` beside `plugin.json`.

### D4: Typed versioning.strategy on authoring load

- **Choice:** Replace `versioning?: unknown` with a small typed `{ strategy: "lockstep" | "tag_pattern" | "per_package" }` (default lockstep); unknown strategy fails at load.
- **Why:** Gate needs a validated strategy; authoring already allows the `versioning` key.
- **Alternatives:** Soft-default unknown strings to lockstep — rejected (fail closed).

### D5: CLI surface and exit codes

- **Choice:** Add `--check-versions` to `parsePackArgs` / help. Gate-only when flag set without archive/marketplace-write intent (mirror `--check-release` gate-only pattern). On misalignment use a dedicated non-zero exit (prefer APM-like `3` if CLI already reserves codes; otherwise document a single non-zero pack failure code consistent with existing pack errors—implementer picks one stable code and tests assert it). Skip-with-info when no marketplace.
- **Why:** Discoverability next to other pack gates; APM skip semantics avoid false failures on non-marketplace projects.
- **Alternatives:** Require marketplace always — rejected (APM logs skip).

### D6: tag_pattern rendering

- **Choice:** Reuse or thin-wrap existing marketplace tag pattern rendering already used by PackOutputs resolve (`build.tagPattern` / per-entry `tag_pattern`, placeholders `{name}` `{version}`). Duplicate rendered tags fail closed (APM behavior).
- **Why:** Avoid a second pattern dialect.
- **Alternatives:** New mini-renderer — unnecessary duplication.

### D7: Docs

- **Choice:** Update `apps/docs/reference/pack.md` flag table + short note that local plugin collections may omit YAML and supply version via `plugin.json`, with YAML authoritative when present. Optionally one sentence in agent-plugins / package-types guide if a pack cross-link already exists—keep minimal.
- **Why:** Parent criteria: docs/help.

## Risks / Trade-offs

- [Exit code `3` vs generic non-zero] → Prefer documenting one stable code in help/tests; do not invent a JSON envelope just for codes.
- [Both `bapm.yml` and `apm.yml` in a package] → Fail closed via dual-read discover; rare for plugin collections.
- [AgentPlugins root-only vs version-gate multi-path] → Document that version check locations follow APM finder; portable AP validation remains root `plugin.json`.
- [Strategy typing tightens previously opaque `versioning`] → Unknown strategy now fails load; acceptable OpenAPM/APM alignment.

## Migration Plan

- Additive CLI flag; no lockfile bump.
- Existing marketplaces without `versioning` get lockstep default when the gate runs.
- Rollback: remove flag / helper; authoring still loads if strategy typing is behind the same change (revert together).

## Open Questions

None — precedence, strategies, skip-without-marketplace, and separation from `--check-release` locked to APM #2454 + parent criteria.
