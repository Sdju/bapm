import type { OutdatedApi } from "@/modules/Outdated";

export async function outdatedCommand(argv: string[], outdated: OutdatedApi): Promise<number> {
  const result = await outdated.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
