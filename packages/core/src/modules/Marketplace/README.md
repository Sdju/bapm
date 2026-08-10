# Marketplace

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Consumer marketplace registry for `@b-apm/core`: models + parse, `~/.bapm/marketplaces.json` CRUD, fetch/cache (`github` | `url` | `local`), thin validate.

## Public API

- Paths: `getBapmConfigDir`, `marketplacesJsonPath`, `marketplaceCacheDir`, `ensureBapmConfigDir`
- Models: `MarketplaceSource`, `createMarketplaceSource`, `parseMarketplaceJson`, `urlNamesRemoteManifest`
- Registry: `listMarketplaces`, `getMarketplace`, `addMarketplace`, `removeMarketplace`
- Fetch: `fetchMarketplace`, `clearMarketplaceCache`, `autoDetectMarketplacePath`
- Validate: `validateMarketplace`
- Errors: `MarketplaceError`, `MarketplaceNotFoundError`, `MarketplaceFetchError`

## Example

```ts
import { createMarketplaceSource, addMarketplace, fetchMarketplace } from "@/modules/Marketplace";

const source = createMarketplaceSource({
  name: "demo",
  url: "/path/to/marketplace.json",
  path: "",
});
await fetchMarketplace(source, { forceRefresh: true });
addMarketplace(source, { configDir });
```

Does **not** import Registry HTTP client.
