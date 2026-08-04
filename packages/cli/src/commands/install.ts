import type { InstallApi } from "@/modules/Install";

export async function installCommand(argv: string[], install: InstallApi): Promise<number> {
  const result = await install.run({ args: argv });
  return result.ok ? 0 : 1;
}
