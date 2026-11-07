---
feod-profile: 1
---

# FEOD profile

> Overrides the defaults of the feod skill. To change it, run the skill's init flow again.

| Parameter                           | Value                                                |
| ----------------------------------- | ---------------------------------------------------- |
| modification                        | base                                                 |
| multiapp                            | no                                                   |
| framework                           | none (TypeScript CLI + library)                      |
| srcRoot / alias                     | packages/cli/src + packages/core/src / @             |
| layers                              | app, commands, modules, common, globals              |
| pages                               | omit (commands layer is CLI dispatch, not URL pages) |
| modulePages                         | no                                                   |
| fileBasedRouting                    | no                                                   |
| privatePageModules (`pages/_name/`) | forbid                                               |
| common.allowIndex                   | false                                                |
| modules.allowDeepImports            | false                                                |
| singleFileModules                   | no                                                   |
| transitModules                      | none                                                 |
| uiKit                               | n/a                                                  |
| layouts                             | n/a                                                  |
| ioc                                 | soft                                                 |
| ddd                                 | no                                                   |
| lint                                | oxlint (wired: yes)                                  |

## Project notes

- FEOD roots are `packages/cli/src` and `packages/core/src`; integration packages are flat
  adapters and stay outside FEOD.
- `packages/cli` uses `commands` as the pages-role directory; `packages/core` keeps an empty
  `pages` stub.
- `packages/cli` depends on `packages/core` public API (`@b-apm/core`); no reverse dependency.
- Package entry files (`packages/*/src/index.ts`, `packages/cli/src/cli.ts`) are thin façades and
  are excluded from FEOD inventory.
- FEOD lint runs via `node scripts/check-feod.mjs` with the Oxlint bundled by Vite+; `pnpm check`
  and `pnpm ready` include it.
- The `feod` skill is installed from `Sdju/feod` (`skills/feod`) through the `bapm.yml` dependency,
  not vendored under `.apm/`.
