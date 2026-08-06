import type { SearchApi } from "@/modules/Search";

export async function searchCommand(argv: string[], search: SearchApi): Promise<number> {
  const result = await search.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
