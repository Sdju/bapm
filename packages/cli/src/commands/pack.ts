import type { PackApi } from "@/modules/Pack";

export async function packCommand(argv: string[], pack: PackApi): Promise<number> {
  const result = await pack.run({ args: argv, cwd: process.cwd() });
  if (result.ok) return 0;
  return result.exitCode ?? 1;
}
