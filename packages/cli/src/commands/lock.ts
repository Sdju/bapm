import type { LockApi } from "@/modules/Lock";

export async function lockCommand(argv: string[], lock: LockApi): Promise<number> {
  const result = await lock.run({ args: argv, cwd: process.cwd() });
  if (result.ok) {
    if (result.message) console.log(result.message);
    return 0;
  }
  if (result.message) console.error(result.message);
  return result.exitCode || 1;
}
