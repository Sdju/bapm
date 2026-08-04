## 1. Core foundations (shared helpers + Resolver)

- [ ] 1.1 Export Install deployed-hash verify / inventory cleanup helpers via `modules/Install` public API for reuse by Audit / Uninstall
- [ ] 1.2 Extend Resolver update options with package scope (rs-012) so non-scoped direct pins stay identical
- [ ] 1.3 Implement lk-010 purge of git-semver modules install path before re-download on update-mode resolve
- [ ] 1.4 Re-export any new Resolver/Install symbols from `app/publicApi` / package entry without breaking existing exports

## 2. Core Update + Outdated

- [ ] 2.1 Add `modules/Update` (directory + `index.ts`): plan full/scoped re-resolve; apply path writes lock and composes non-frozen install; support dry-run
- [ ] 2.2 Wire Update confirm semantics at API level (`yes` / dry-run flags); frozen without override fails closed
- [ ] 2.3 Add `modules/Outdated`: compare lock pins to remote tips via existing git/tag ports; statuses outdated | up-to-date | unknown
- [ ] 2.4 Outdated: no lock → non-success; outdated rows still success (exit 0 at CLI)

## 3. Core Uninstall + Prune + Deps

- [ ] 3.1 Add `modules/Uninstall`: remove named deps from manifest (dual-read write-back), modules, deployed inventory, lock (+ orphaned transitives); support dry-run; unknown name fails
- [ ] 3.2 Add `modules/Prune`: remove orphan dirs under modules not in resolved graph; keep declared/locked; support dry-run
- [ ] 3.3 Add `modules/Deps`: `list` and `tree` from lock
- [ ] 3.4 (SHOULD) Add `deps why` offline reverse walk if lock edges make it cheap; otherwise document defer in module README

## 4. Core Audit + Doctor

- [ ] 4.1 Add `modules/Audit` `runAuditCi`: lock present; deployed files present; hash re-verify (lk-017/sc-001); exit-style result 0/1; do not fail solely on missing `tree_sha256`
- [ ] 4.2 Add `modules/Doctor`: git on PATH (critical); readable manifest/lock if present; modules dir sanity; non-zero on critical fail
- [ ] 4.3 Export Update/Outdated/Uninstall/Prune/Deps/Audit/Doctor public APIs from package entry

## 5. CLI FEOD surface

- [ ] 5.1 Add command constants and thin `commands/` handlers for `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`
- [ ] 5.2 Add matching `modules/<Name>/` + `app/init/` soft IoC wiring; register in `app/registry.ts`
- [ ] 5.3 Update help to list all M6 commands (not stubs); hard-error unknown flags on new commands
- [ ] 5.4 Update CLI: `--dry-run`, `-y`/`--yes`, TTY confirm default No, non-TTY require `-y` for mutating apply
- [ ] 5.5 `deps` dispatches `list` | `tree` (| `why` if present); `audit` accepts `--ci`; `prune` is top-level

## 6. Package graph + verification (apply only)

- [ ] 6.1 Confirm workspace still has only `bapm-target-api` + `bapm-target-cursor` among `bapm-target-*`; no core→cursor hard dep
- [ ] 6.2 Keep M1–M5 install/lock/cursor regressions green
- [ ] 6.3 Run build/test/`vp check` for `@bapm/core` and `bapm`; fix in-scope regressions
- [ ] 6.4 Spot-check: `outdated` exit 0 with outdated rows; `audit --ci` exit 1 on hash mismatch / missing lock / missing deployed file
