import type { SelfUpdateApi } from "@/modules/SelfUpdate";

export async function selfUpdateCommand(
  argv: string[],
  selfUpdate: SelfUpdateApi,
): Promise<number> {
  const result = await selfUpdate.run({ args: argv, cwd: process.cwd() });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
