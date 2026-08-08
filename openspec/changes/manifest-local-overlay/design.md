## Context

See `proposal.md` — Why. Base dual-read (`manifest-dual-file-discovery`) loads exactly one of `bapm.yml` / `apm.yml` with no merge. Effective host selection (`manifest-active-targets`) and object-map integration load already run from the validated base document plus CLI `--target`. Pack walks the project tree and only skips `.git` / `node_modules` / `*.zip` / secret basename patterns — a personal overlay sitting next to the manifest would be packed today unless excluded. Dependency source `local` / `.agents/local` is unrelated naming.

Related in-flight change `manifest-env-bake` introduces top-level `env:` on the base manifest for bake defaults; this overlay must deep-merge into that effective `env` map when both land.

## Goals / Non-Goals

**Goals:**

- Optional personal overlay file `bapm.local.yml` at the project manifest root.
- Explicit allowlist + per-field merge rules; fail closed on unknown keys and on `apm.local.yml`.
- Fixed precedence for settings: **flags → local → base → env** (env only where a setting has / gains an env override).
- Keep the file out of git/pack/publish surfaces; warn via doctor when tracked.
- Docs that distinguish overlay from `local:` dependency source.

**Non-Goals:**

- Walk-up discovery; dual-brand local filenames; overlaying identity or dependency graphs.
- Changing bake placeholder order beyond feeding the **effective** merged `env` map into the existing bake lookup (overrides → process.env → effective `env`).
- Auto-writing a stub `bapm.local.yml` on every init (gitignore + docs suffice for v1).

## Decisions

### 1. Filename and discovery

- Constant `BAPM_LOCAL_MANIFEST_FILE = "bapm.local.yml"`.
- Discover only in the same project root used for base dual-read (cwd / explicit root; **no** parent walk-up).
- Optional: missing file → effective settings = base only.
- If `apm.local.yml` exists in that root → **hard error** (refuse dual-brand local), even when `bapm.local.yml` is absent. Rationale: avoid a second dual-read matrix; v1 is bapm-branded personal overlay only.
- Explicit `--manifest` / path to base does **not** rename the local sibling: local is still looked up as `<dirname(baseOrRoot)>/bapm.local.yml` when the project root is that directory (same root as discovery).

**Alternatives:** dual-read `apm.local.yml` like base — rejected for v1 complexity and typo/brand confusion. Walk-up — rejected (matches base no-walk policy).

### 2. Settings precedence (normative)

| Priority | Layer | Notes |
|----------|--------|--------|
| 1 | Direct CLI flags | e.g. `--target` forced host |
| 2 | `bapm.local.yml` | Allowlisted fields only |
| 3 | Base `bapm.yml` **or** `apm.yml` | Existing dual-read, exactly one |
| 4 | Process env overrides | Only for settings that already have / later gain an env override; does **not** invent env for every field in v1 |

CLI flags always win over local for the same concern (notably `--target` vs local/base `active`).

**Bake lookup (orthogonal):** remains `bake overrides → process.env → effective top-level env map`. Effective `env` = deep-merge(base.env, local.env) with local keys winning. Ambient process env still wins over YAML `env` values for **placeholder resolution** (secrets hygiene); that does not let process env override `active` / `targets` unless a dedicated setting env var is defined later under layer 4.

### 3. Overlay schema = allowlist (not full manifest)

Local file MUST be a YAML mapping. It MUST NOT require `name` / `version`.

**Allowlisted top-level keys (v1):**

| Key | Merge rule |
|-----|------------|
| `active` | **Replace** entire list when present in local (no append/union). |
| `target` | See target merge below. |
| `targets` | See target merge below. |
| `env` | **Deep-merge** string map: local key wins; base keys retained if absent in local. Values are plain strings (same validation as base `env` when that field ships). |
| `registries` | **Deep-merge** by registry name: local entry replaces/overlays that name; other base names retained. Per-entry object fields: shallow merge (local field wins). Local string URL form replaces the whole entry for that name. `registries.default` (if modeled as part of the registries block) follows the same key overlay. |

**Forbidden in local (fail closed):** `name`, `version`, `dependencies`, `devDependencies`, and any other non-allowlisted key (including unknown/`x-*` in v1 — keep the overlay strict so personal files stay auditable).

After merge, effective `target` vs `targets` mutual exclusion and mf-005 validation MUST hold on the **merged** document (same rules as base validate).

### 4. `target` / `targets` merge detail

1. If local omits both → keep base forms.
2. If local sets `active`-adjacent maps only via `target` or `targets`:
   - When **both** sides are object-maps for the same field name: **deep-merge keys** (local host key wins package string).
   - When local sets a field and shapes differ (e.g. local object-map, base string/array) **or** local uses legacy string/array: **replace** that field with the local value.
3. If local sets one of `target`/`targets` and base has the other: after applying local, clear the sibling on the effective doc if mutual exclusion would break (local’s declared field wins; drop the other), then re-validate.

Object-map load and `active` activation use the **effective** maps/lists after merge; `--target` still forces a single host.

### 5. Load pipeline placement

Prefer a single `loadEffectiveManifest` (or extend `loadManifest`) in `@bapm/core` Manifest:

1. Discover/load/validate base (unchanged dual-read).
2. Detect `apm.local.yml` conflict → error.
3. If `bapm.local.yml` present → parse YAML, validate allowlist + field shapes, merge → validate effective document.
4. Return document + metadata (`sourcePath`, `localPath?`).

Call sites that already use `loadManifest` for install/compile/bake/map-load should consume the effective document so behavior is consistent.

### 6. Unpublished guarantees

1. **Gitignore:** Document pattern `bapm.local.yml`. Init / first-use MAY append the pattern to project `.gitignore` when missing (reuse the ensure-append helper style from `local` source). Do **not** fail install solely because the ignore line is missing if the file is untracked; **do** warn via doctor if tracked.
2. **Pack:** `collectPackFiles` MUST skip basename `bapm.local.yml` (exclude, not secret-refuse — secrets refuse aborts; personal overlay should silently omit).
3. **Publish:** Registry/flat zip construction MUST NOT include `bapm.local.yml` (same exclude when walking or when selecting root files).
4. **Doctor:** If `bapm.local.yml` exists and `git ls-files` (or equivalent) shows it tracked → **non-critical warning** with untrack guidance (`git rm --cached bapm.local.yml` + gitignore). MUST NOT alone force non-zero exit.

### 7. Docs

- `config-manifest.md`: personal overlay section — filename, allowlist, merge rules, precedence table, not `local:` source.
- Quick-start: short “личный local overlay” / personal overlay callout.
- Conformance boundary: name as bapm-only personal overlay (intentional extension), distinct from OpenAPM and from `local` dependency source.

## Risks / Trade-offs

- **[Risk] Confusing `bapm.local.yml` with `local:` deps** → Mitigation: docs + distinct constant/error copy; refuse treating overlay as package source.
- **[Risk] Secrets in local YAML still leak if user force-adds to git** → Mitigation: gitignore ensure, doctor warning, pack exclude; docs prefer process env for real secrets.
- **[Risk] Shape replace for `target` surprises authors** → Mitigation: document; deep-merge only when both sides are object-maps.
- **[Risk] `manifest-env-bake` not archived yet** → Mitigation: overlay validates `env` the same way; merge is no-op if base has no `env` yet; tasks note dependency on env field landing.
- **[Trade-off] Strict allowlist rejects `x-*` in local** → Acceptable for v1; can loosen later without breaking precedence.

## Migration Plan

- No migration of existing projects: overlay is optional.
- After ship: authors add `bapm.local.yml` + gitignore line; shared `bapm.yml` stays clean.
- Rollback: ignore/delete overlay file; behavior reverts to base-only.

## Open Questions

None that block specs/tasks; bake vs settings env layering is resolved in Decisions §2.
