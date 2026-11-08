import type { AuthApi } from "@/modules/Auth";

export async function authCommand(argv: string[], auth: AuthApi): Promise<number> {
  const result = await auth.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
