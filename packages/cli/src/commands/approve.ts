import type { ApproveApi } from "@/modules/Approve";

export async function approveCommand(argv: string[], approve: ApproveApi): Promise<number> {
  const result = await approve.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
