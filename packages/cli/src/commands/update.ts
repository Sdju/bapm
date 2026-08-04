import type { UpdateApi } from "@/modules/Update";

export async function updateCommand(argv: string[], update: UpdateApi): Promise<number> {
  const result = await update.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
