## Context

Consumer surface (M1–M6) is in place: Manifest already has `serializeManifest` / `writeManifest` and parse rejects `workspaces`; CLI has lifecycle commands under locked FEOD. No pack/init/release-check yet; no zip dependency in the workspace catalog. Normative bar: `.samples/apm-knowledge/topics/m7-producer-acceptance.md`. See `proposal.md` for motivation; behavior in delta specs. FEOD: locked CLI profile + library-core for `@b-apm/core`. No new `bapm-target-*`.

## Goals / Non-Goals

**Goals:**

- Thin FEOD CLI surface for `init` and `pack` (including `--check-release`)
- Core APIs: minimal manifest scaffold + validate-on-write; plain-zip pack/extract; sc-007 secret refuse; pr-004 tag↔version gate
- Round-trip via `install <archive.zip>` (primary unpack equivalent)
- Harden mf-005 target-token validation on emit/validate
- Reuse existing Manifest parse/load dual-read; no second host package

**Non-Goals (design-level):**

- APM `--format plugin` / marketplace / `plugin init` / mf-017 (M9)
- Registry `publish` (M10)
- Governance policy-extended secret patterns (M8)
- Auto tag create/push from CLI
- New argv framework beyond existing parse patterns
- Hand-editing package manifests — add zip lib via pnpm catalog CLI only

## Decisions

### 1. Archive format = plain zip

- **Choice:** Default M7 distributable is a **plain zip** of the project tree (manifest at archive root; optional lock / `.apm`-style primitives). Not APM plugin format.
- **Why:** User-locked default; OpenAPM-ish Producer floor; plugin host bundles deferred to M9.
- **Alternatives:** APM `--format plugin` — rejected for M7; tar.gz additionally — optional later, zip is MUST floor.

### 2. pr-004 gate = `bapm pack --check-release`

- **Choice:** Explicit flag on `pack`: `--check-release` with optional `--tag <name>`. When `--tag` omitted, resolve tag(s) pointing at HEAD; fail closed if none. Strip optional leading `v`; compare to manifest `version`; enforce semver+`v?` regex for git-semver gate. No dedicated top-level `check-release` command in M7 (discoverability via pack help).
- **Why:** User default for the open question; keeps release awareness next to pack without implying publish.
- **Alternatives:** `bapm doctor` subsection — less discoverable for release CI; standalone `check-release` — fine later if needed.

### 3. Round-trip = install-from-archive (no required unpack command)

- **Choice:** Primary consume path is `bapm install <path-to.zip>`: detect zip → extract to workdir/project → continue with existing install orchestration on the landed manifest. Thin `bapm unpack` is **out** unless apply finds extract-only useful for tests; specs allow install-only.
- **Why:** Matches APM “prefer install over deprecated unpack”; one path enough for MUST.
- **Alternatives:** Mandatory `unpack` command — extra surface; extract-only without install — weaker product drop-in.

### 4. Core module split

- **Choice:**
  - **Manifest:** add `createMinimalManifest` (+ validate-before-write wrapper that runs `parseManifestDocument` / equivalent before `writeManifest`); tighten mf-005 token checks in parse/emit.
  - **Pack** directory module: `runPack`, `extractPackArchive`, secret-pattern matcher (sc-007), zip create via library added to catalog.
  - **Release check** colocated in Pack (`checkReleaseTag`) — always used with pack gate; avoid a one-function module.
- **Why:** Library-core FEOD (no single-file modules); mirrors CLI Init + Pack command map; release check is pack-adjacent.
- **Alternatives:** Separate `Release` module — unnecessary indirection for M7; put zip only in CLI — rejected (core owns domain for fixtures).

### 5. CLI FEOD wiring

- **Choice:** `commands/init.ts`, `commands/pack.ts` thin handlers; `modules/Init/`, `modules/Pack/` with `index.ts`; register in `app/registry.ts`; constants in `common/constants/commands.ts`; soft IoC in `app/init/init.ts` and `app/init/pack.ts` via `app/integrations/core.ts`. Help lists `init`, `pack`.
- **Why:** Locked FEOD profile; same pattern as M6 lifecycle modules.
- **Alternatives:** Business logic in commands — forbidden by profile.

### 6. Init defaults

- **Choice:** Always write **`bapm.yml`**. Refuse if `apm.yml` **or** `bapm.yml` exists. `-y` defaults: `version: "0.1.0"`, name from argv or directory basename, empty `dependencies.apm`/`mcp` (APM-like minimal), optional `target: cursor` when `--target cursor` or `.cursor/` detected. No `--plugin` / marketplace scaffold.
- **Why:** Dual-read aware default brand; M7 cursor-thin product.
- **Alternatives:** Write `apm.yml` for drop-in — rejected (normative default `bapm.yml`); interactive multi-host catalog — noise, deferred.

### 7. Secret patterns (sc-007)

- **Choice:** Fixed default denylist on basename/path segments: `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`. Match any file that would be included in the pack set; fail closed before durable zip finalize. No policy file extension in M7.
- **Why:** OpenAPM §10.3 producer clause floor.
- **Alternatives:** Soft-warn only — rejected (MUST refuse); policy YAML — M8.

### 8. Zip dependency

- **Choice:** Add a maintained zip library to the pnpm catalog via CLI (`pnpm-dependencies` skill) — prefer a small ESM-friendly option (e.g. `fflate` or `jszip`); implement pack/extract behind Pack module ports so the concrete lib can change.
- **Why:** Catalog-only dependency discipline; Node has no stable high-level zip in stdlib for all targets.
- **Alternatives:** Shell out to `zip`/`unzip` — fragile on Windows/CI; hand-roll ZIP — error-prone.

### 9. Pack contents / excludes

- **Choice:** Include project files needed for redistribute: manifest, lock if present, agentic primitives / `.apm` if present. Exclude by default: `node_modules`, `.git`, existing pack artifacts, and secret matches. Directory pack output MAY be supported as a non-zip mode; `--archive` is the MUST path for zip.
- **Why:** Enough for Producer-as-Consumer smoke without copying entire VCS history.
- **Alternatives:** Pack entire tree including `.git` — rejected (size + secret risk).

### 10. mf-005 token set

- **Choice:** Accept documented OpenAPM canonical/alias host tokens used by APM (at least `cursor`, and other well-known aliases from the OpenAPM/APM set already referenced in samples) **or** `x-<vendor>-<name>`. Reject free-form `not-a-host`. Align parse + producer write.
- **Why:** mf-005 MUST on emit/validate; current parse only checks non-empty string.
- **Alternatives:** Accept any string until deploy — weaker Producer claim.

### 11. pr-005 advisory

- **Choice:** If signing info is cheap to detect (annotated tag GPG/SSH), emit warning when unsigned; never fail M7 solely for unsigned. Document producer signing guidance in module README / help text briefly.
- **Why:** SHOULD only; consumers don’t enforce in v0.1.
- **Alternatives:** Hard-fail unsigned — violates M7 bar.

### 12. `--check-release` vs pack archive coupling

- **Choice:** `--check-release` MAY run without producing an archive (gate-only). Combining with `--archive` is allowed: run gate first, then pack on success. `--dry-run` skips durable zip write but MAY still run validation/gate.
- **Why:** CI can check tags without always emitting artifacts.
- **Alternatives:** Always require zip when checking — unnecessary.

## Risks / Trade-offs

- **[Zip lib choice / catalog pin]** → Mitigate via Pack ports + pnpm catalog; keep extract/create behind thin adapters.
- **[install archive vs package-ref ambiguity]** → Detect by filesystem: existing `.zip` file path wins over git-ref parse; document in install help.
- **[mf-005 alias list drift vs APM]** → Start from OpenAPM/APM documented host set; cursor MUST; don’t invent bapm-only host ids.
- **[Large trees / secret false negatives]** → Default excludes + basename patterns; document that policy extension is M8.
- **[HEAD multi-tag]** → If multiple tags on HEAD, prefer exact semver match to manifest version; else fail with diagnostic listing candidates.

## Migration Plan

- Additive CLI commands and core exports only; no breaking rename of existing Consumer APIs.
- Existing projects without `bapm.yml` keep dual-read; `init` only for greenfield.
- Rollback: remove Init/Pack commands and Pack module exports; Consumer paths untouched.

## Open Questions

- Exact zip library pin among ESM options — resolve at apply via catalog CLI; does not change specs.
- Whether directory (non-zip) pack output ships in the same PR as `--archive` — specs allow; apply MAY ship zip-only first if timeboxed, as long as `--archive` MUST path is green.
