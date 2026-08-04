import type { PackApi } from "@/modules/Pack";

export async function packCommand(argv: string[], pack: PackApi): Promise<number> {
  const result = await pack.run({ args: argv, cwd: process.cwd() });
  return result.ok ? 0 : 1;
}
