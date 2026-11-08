import type { RuntimeApi } from "@/modules/Runtime";

export async function runtimeCommand(argv: string[], runtime: RuntimeApi): Promise<number> {
  const result = await runtime.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
