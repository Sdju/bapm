import type { MarketplaceApi } from "@/modules/Marketplace";

export async function marketplaceCommand(
  argv: string[],
  marketplace: MarketplaceApi,
): Promise<number> {
  const result = await marketplace.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
