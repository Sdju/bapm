import type { CacheApi } from "@/modules/Cache";

export async function cacheCommand(argv: string[], cache: CacheApi): Promise<number> {
  const result = await cache.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
