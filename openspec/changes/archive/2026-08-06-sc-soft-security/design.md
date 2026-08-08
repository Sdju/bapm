## Context

See proposal.md — Why. Today Pack `extract.ts` and Registry `materializeRegistryArchive` reject `..` / absolute paths only; both use fflate `unzipSync` which yields file bytes without symlink metadata, so symlink zip-slip is unenforced. Manifest `validateRegistries` allowlists `url` / `aliases` / `x-*` and rejects `insecure`; `assertHttpUrl` accepts bare `http://` without a gate. Mode B keeps sc-002/sc-006 skipped after mp-sc-claims honesty.

Criteria source: `.samples/apm-knowledge/topics/sc-implement-then-claim-criteria.md` (G1–G10).

## Goals / Non-Goals

**Goals:**

- Close G1–G10 in one change with code + Mode B claim flip for sc-002 + sc-006 only.
- Shared safe-extract policy for Pack + Registry; keep lk-013 digest-before-extract.
- Truthful checklist / Limitations; `conformance:gen` + `conformance:check` green.

**Non-Goals:**

- tar.gz-only / reject zip (sc-004 claim).
- Host-class AuthResolver / redirect Auth drop / ambient suppress (sc-003/005/008/013).
- Approve / org deny / audit fidelity (sc-010–012).
- Configurable caps (SHOULD S1 — optional later; defaults fixed).

## Decisions

### D1: Shared `archiveSafe` helper under Pack (or small sibling module)

- **Choice:** One shared extract helper used by Pack extract and Registry materialize (prefer Pack-adjacent or `modules/common`-style util exported for Registry). Identical twin copies only if FEOD import edges block sharing — then document twin + shared tests.
- **Why:** Closes G6; one place for symlink/caps/cleanup rules.
- **Alternatives:** Duplicate logic in Pack + Registry — rejected unless FEOD forces it.

### D2: Zip central-directory / ZipInfo pre-scan for symlink bits

- **Choice:** Do not rely on `unzipSync` alone for safety metadata. Pre-scan zip for entry names, uncompressed sizes, and unix mode / external_attr (symlink `0xA000`) before or while extracting; reject on first bad entry. Use a minimal CD reader or a library path that exposes ZipInfo-level fields (APM `safe_extract_zip` intent).
- **Why:** fflate’s simple map loses symlink distinction (G1).
- **Alternatives:** Switch zip library wholesale — heavier; defer unless pre-scan is insufficient.

### D3: Hardlink / non-regular (G2)

- **Choice:** For zip, reject symlink; treat other non-file unix types as reject when detectable. Hardlink is typically N/A for zip — document as covered when format exposes it; no tar path in this change.
- **Why:** Criteria: hardlink where applicable; zip focus.

### D4: Fail-closed cleanup (G3)

- **Choice:** Prefer extract to a staging directory under dest’s parent then atomic rename on success; on any failure, `rm` staging (and any partial dest if write-in-place was used). If in-place write is required for existing callers, on throw remove the dest tree created for this materialize.
- **Why:** No dangling half-write claiming success.
- **Alternatives:** Leave partial + mark failed — rejected (MUST cleanup).

### D5: Caps (G4/G5)

- **Choice:** Defaults `maxEntries = 10_000`, `maxUncompressedBytes = 100 * 1024 * 1024`. Count file members (skip pure directory markers consistently). Accumulate uncompressed sizes from CD or inflated bytes; fail closed before completing success.
- **Why:** OpenAPM-aligned; soft-closes sc-004b/c without claiming format.

### D6: Registries insecure gate (G7/G8)

- **Choice:** Allow `insecure: boolean` on registry objects; keep mf-015 for other keys. Add `isExemptInsecureHost(hostname)` for loopback / `::1` / RFC1918. Gate: `http://` → error unless `insecure === true` OR exempt host; error message includes registry name. String URL entries: no insecure flag → require exempt host for http.
- **Why:** OpenAPM §4.2.3 / APM `_parse_v01_registries_block`.
- **Alternatives:** Install-time-only gate — rejected (criteria: parse-time).

### D7: Claim flip + honesty (G9/G10)

- **Choice:** Edit `tests/spec-conformance/checklist.yml` only after GREEN coverage exists: sc-002/sc-006 → active with citations to acceptance/unit paths under `**/sc-soft-security/` (or promoted suite). Refresh sc-004 rationale. Update Limitations soft zip + caps. Run `conformance:gen` / `conformance:check`. Update docs guide residual wording.
- **Why:** Implement-then-claim; no fake actives.
- **Alternatives:** Flip checklist before code — forbidden.

### D8: lk-013 ordering unchanged

- **Choice:** `verifyArchiveDigest` then safe-extract; mismatch never extracts.
- **Why:** MUST NOT weaken digest verify.

## Gaps → design map

| Gap                      | Decision / landing |
| ------------------------ | ------------------ |
| G1 Symlink reject        | D2 + D1            |
| G2 Hardlink/non-regular  | D3                 |
| G3 Cleanup               | D4                 |
| G4 Entry cap             | D5                 |
| G5 Size cap              | D5                 |
| G6 Unify Pack+Registry   | D1                 |
| G7 Allow insecure        | D6                 |
| G8 http gate + name      | D6                 |
| G9 Mode B + gen          | D7                 |
| G10 Limitations / sc-004 | D7                 |

## Risks / Trade-offs

- **[Risk] fflate lacks ZipInfo** → Mitigation: CD pre-scan module; add focused unit tests with crafted symlink zips.
- **[Risk] Staging rename races / cross-device** → Mitigation: staging on same filesystem as dest; fallback cleanup-in-place documented.
- **[Risk] Cap false positives on large legitimate packs** → Mitigation: defaults match OpenAPM; optional env later (S1).
- **[Risk] Claiming sc-002 without symlink path** → Mitigation: acceptance MUST include symlink fixture; checklist flip only after GREEN.
- **[Risk] sc-008 creep** → Mitigation: after G8, only re-check if git-HTTP+creds attaches tokens; else leave skipped (S3).

## Migration Plan

1. Land safe-extract + wire Pack/Registry; unit tests RED→GREEN via orchestrate.
2. Land insecure parse gate + fixtures.
3. Flip checklist + Limitations + gen/check; docs align.
4. No user data migration; fail-closed behavior may break manifests that used remote `http://` registries without `insecure: true` (**BREAKING** for that niche — intentional OpenAPM alignment).

## Open Questions

_None blocking plan — shared helper vs twin resolved as D1 prefer shared; sc-004 stays skipped; single change preferred over split._
