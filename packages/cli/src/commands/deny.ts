import type { DenyApi } from "@/modules/Deny";

export async function denyCommand(argv: string[], deny: DenyApi): Promise<number> {
  const result = await deny.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
