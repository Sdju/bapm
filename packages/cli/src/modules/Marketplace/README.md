# Marketplace (CLI)

Consumer registry (`add|list|browse|update|remove|validate`) and authoring
(`init|package|check|migrate`) over `@bapm/core` Marketplace APIs.

## Public API

- `createMarketplace(deps?)` → `{ run, formatHelp }`
- `formatMarketplaceHelp`, `parseMarketplaceArgs`

## Notes

- Thin `commands/marketplace.ts` only; domain logic in this module + core.
- Authoring does **not** emit host marketplace.json (pack deferred).
