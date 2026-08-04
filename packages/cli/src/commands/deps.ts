import type { DepsApi } from "@/modules/Deps";

export async function depsCommand(argv: string[], deps: DepsApi): Promise<number> {
  const result = await deps.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
