import type { PruneApi } from "@/modules/Prune";

export async function pruneCommand(argv: string[], prune: PruneApi): Promise<number> {
  const result = await prune.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
