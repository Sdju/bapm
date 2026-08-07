## 1. Core local view API

- [x] 1.1 Add `@bapm/core` FEOD `View` module (directory + `index.ts`) with types for view result (ok, exitCode, identity, version/pin, modulesPath?, summary?, text, error?)
- [x] 1.2 Implement lock load + package query resolve (reuse/share Deps why exact + owner/repo + basename forms; exact wins; ambiguous / not_installed / no_lockfile)
- [x] 1.3 Locate modules path via existing tree locator; read optional package-manifest `summary`/`description`; build human text + pin fallback chain
- [x] 1.4 Export public view orchestration from module `index.ts` and `app/publicApi` (no deep imports; no network)

## 2. CLI FEOD `view` command

- [x] 2.1 Add `COMMAND_VIEW`, `modules/View` (`createView`), thin `commands/view.ts`, app init + registry wiring
- [x] 2.2 Parse: required package positional; `--help`/`-h`; reject unknown flags, extra positionals (incl. `versions`), `--registry`/`-g`
- [x] 2.3 Map core result to stdout/stderr + exit codes 0/1/2; update top-level Help to list `view`

## 3. Behavioural verification

- [x] 3.1 Core/unit behavioural coverage: success fields, basename resolve, ambiguous, not_installed, no_lockfile, missing summary honesty (no source analysis)
- [x] 3.2 CLI behavioural coverage via `runCli`: happy path, missing package, missing lock, missing arg, unknown flag, `versions` reject, help, top-level help lists `view`
- [x] 3.3 Run scoped `vp`/`vitest` checks for touched packages until green

## 4. Docs (optional SHOULD)

- [x] 4.1 Add short `apps/docs/reference/view.md` (local-only; no versions/registry) and sidebar/nav link if docs change is in scope for the apply pass
