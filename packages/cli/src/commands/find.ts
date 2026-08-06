import type { FindApi } from "@/modules/Find";

export async function findCommand(argv: string[], find: FindApi): Promise<number> {
  const result = await find.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
