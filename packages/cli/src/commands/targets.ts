import type { TargetsApi } from "@/modules/Targets";

export async function targetsCommand(argv: string[], targets: TargetsApi): Promise<number> {
  const result = await targets.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
