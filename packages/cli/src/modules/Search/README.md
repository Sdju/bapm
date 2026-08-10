# Search

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Top-level `bapm search QUERY@MARKETPLACE` consumer command.

## Public API

- `createSearch(deps?)` — CLI module factory
- `formatSearchHelp` / `parseSearchArgs` — help + argv parsing

## Example

```ts
import { createSearch } from "@/modules/Search";

const search = createSearch();
await search.run({ args: ["demo@local-mp", "--limit", "5"] });
```
