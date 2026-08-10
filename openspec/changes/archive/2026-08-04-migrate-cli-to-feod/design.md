## Context

See `proposal.md` for motivation. Current `packages/cli` is flat: `src/cli.ts` boots `runCli` from `src/run.ts`; `src/index.ts` re-exports `runCli`. All command logic and direct `@b-apm/core` imports live in `run.ts`. Locked FEOD profile and `feod` block in `package.json` already exist; `tsconfig` has no `@/*` paths yet. Scope is only `packages/cli`.

## Goals / Non-Goals

**Goals:**

- Map existing CLI surface onto locked FEOD layers without changing observable command behavior.
- Wire `@b-apm/core` only through `app/integrations` + soft IoC in `app/init`.
- Keep `vp pack` entries and public `runCli` compatible.

**Non-Goals:**

- Changing FEOD profile parameters or adding feod ESLint plugin.
- Implementing real install / lock / resolver flows.
- Touching `@b-apm/core` or `apps/docs`.

## Decisions

### D1 — Target layout (locked FEOD)

```
packages/cli/src/
  app/
    entry.ts          # process bootstrap helpers if needed
    registry.ts       # manual command map
    run.ts            # runCli(argv) dispatch via registry
    init/             # soft IoC: createHelp / createVersion / createInstall
    integrations/     # adapters to @b-apm/core (constants, getVersion, …)
  commands/
    help.ts
    version.ts
    install.ts
  modules/
    Help/             # index.ts + services/types as needed
    Version/
    Install/
  common/             # e.g. constants/commands.ts — no index.ts
  globals/            # optional; empty or node ambient later
  cli.ts              # pack/bin entry (shebang) → runCli
  index.ts            # package export → runCli
```

**Rationale:** Matches locked skill structure; keeps pack entry filenames stable.  
**Alternatives considered:** Moving pack entry into `app/cli.ts` only — rejected (would require vite pack / bin path churn). Renaming layers — forbidden by locked profile.

### D2 — Help / Version placement

- Thin handlers in `commands/help.ts` and `commands/version.ts`.
- Presentation / formatting logic in `modules/Help` and `modules/Version` (public API via `index.ts`).
- Shared command name strings MAY live in `common/constants/commands.ts` (concrete file import, no barrel).

**Rationale:** FEOD requires thin commands; even small help/version text is CLI-feature logic, not app bootstrap.  
**Alternatives considered:** Keep help strings inline in commands — rejected (logic in commands). Put everything in `common` — rejected (help/version are feature-shaped, not 1-file utilities without domain).

### D3 — Install stub as module adapter over core

- `modules/Install` exposes `createInstall(deps?)` (soft IoC) with `run(options) → { ok, … }`.
- Stub messages use manifest/lock/name values injected from `app/integrations` (wrapping `@b-apm/core`), assembled in `app/init/install.ts`.
- `commands/install.ts` only parses argv and maps result to exit code.

**Rationale:** Explicit adapter boundary for future real install; commands never import `@b-apm/core`.  
**Alternatives considered:** Direct `@b-apm/core` import inside `modules/Install` — weaker boundary; allowed only if one-way and stable, but locked guidance prefers integrations + init for external packages. Commands importing core — forbidden by proposal.

### D4 — Soft IoC wiring

- Module factories accept optional deps (`logger`, `coreConsts`, `getVersion`, …).
- `app/init/*` constructs instances with integrations.
- Registry / `runCli` use the wired instances (or call factories once at init).

**Rationale:** Soft IoC per locked profile; keeps modules testable without Node/process coupling.  
**Alternatives considered:** Hard-wire console and core inside modules — simpler but skips the profile’s preferred pattern for external deps.

### D5 — Alias and tooling

- Add `compilerOptions.paths`: `"@/*": ["./src/*"]` in `packages/cli/tsconfig.json`.
- Ensure `vite.config.ts` / vp pack resolves the same alias if pack does not inherit tsconfig paths automatically (verify during apply; add `resolve.alias` only if required).

**Rationale:** Cross-level imports must use `@/`.  
**Alternatives considered:** Relative cross-level imports — violates FEOD path rules.

### D6 — Public API compatibility

- `src/index.ts` continues to export `{ runCli }` (from `@/app/run` or relative into `app`).
- `src/cli.ts` remains shebang entry calling `runCli(process.argv.slice(2))`.
- Delete or gut `src/run.ts` after move (no duplicate dispatch).

**Rationale:** User-required compatibility for pack and consumers.  
**Alternatives considered:** Export only from `app/` without root `index.ts` — **BREAKING**, rejected.

### D7 — Defaults for previously open questions (closed)

| Question                | Default                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Help/Version            | Thin `commands/` + logic in `modules/Help` and `modules/Version`                                |
| Install-stub            | `modules/Install` adapter; core via `app/integrations` + `app/init`; thin `commands/install.ts` |
| `runCli` / pack entries | Keep `src/index.ts` + `src/cli.ts` as thin façades                                              |

## Risks / Trade-offs

- [Alias not resolved by vp pack/test] → Mitigation: verify `vp check` / `vp test` / `vp pack` in apply; add vite alias if needed.
- [Over-modularizing tiny help/version] → Acceptable under locked FEOD; modules stay small with thin public API.
- [Existing unit test path breaks] → Update import to still use package `src/index.ts` (`runCli`); behavior unchanged.
- [Accidental deep imports during move] → Checklist from FEOD skill in tasks; review imports before done.

## Migration Plan

1. Add `@/*` paths (and alias in vite if required).
2. Create layer directories and integrations/init skeletons.
3. Extract Help / Version / Install modules; thin commands; app registry + `runCli`.
4. Point `cli.ts` / `index.ts` at app; remove flat `run.ts`.
5. Run `vp check`, `vp test`, `vp pack` in `packages/cli`.
6. Rollback: revert the change branch; no data migration.

## Open Questions

None — open items from explore are closed in D7.
