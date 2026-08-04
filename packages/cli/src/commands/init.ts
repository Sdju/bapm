import type { InitApi } from "@/modules/Init";

export async function initCommand(argv: string[], init: InitApi): Promise<number> {
  const result = await init.run({ args: argv, cwd: process.cwd() });
  return result.ok ? 0 : 1;
}
