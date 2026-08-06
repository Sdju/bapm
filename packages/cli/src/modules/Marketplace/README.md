# Marketplace (CLI)

Consumer `bapm marketplace` command group: add / list / browse / update / remove / validate.

## Public API

- `createMarketplace(deps?)` → `{ run, formatHelp }`
- `formatMarketplaceHelp`, `parseMarketplaceArgs`

Thin handler: `commands/marketplace.ts`. Soft IoC: `app/init/marketplace.ts`.
