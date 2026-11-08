import type { RunApi } from "@/modules/Run";

export async function runCommand(argv: string[], run: RunApi): Promise<number> {
  const result = await run.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
