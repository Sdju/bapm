# View

Top-level `bapm view <package>` — offline local package inspect via `@bapm/core` `viewPackage`.

## Public API

| Export                             | Role                                    |
| ---------------------------------- | --------------------------------------- |
| `createView`                       | Soft IoC factory (`run` / `formatHelp`) |
| `parseViewArgs` / `formatViewHelp` | Arg parse + help text                   |

Thin command handler lives in `commands/view.ts`.
