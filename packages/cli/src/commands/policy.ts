import type { PolicyApi } from "@/modules/Policy";

export async function policyCommand(argv: string[], policy: PolicyApi): Promise<number> {
  const result = await policy.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
