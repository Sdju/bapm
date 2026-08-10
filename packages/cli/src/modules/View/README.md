# View

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Top-level `bapm view <package>` — offline local package inspect via `@b-apm/core` `viewPackage`.

## Public API

| Export                             | Role                                    |
| ---------------------------------- | --------------------------------------- |
| `createView`                       | Soft IoC factory (`run` / `formatHelp`) |
| `parseViewArgs` / `formatViewHelp` | Arg parse + help text                   |

Thin command handler lives in `commands/view.ts`.
