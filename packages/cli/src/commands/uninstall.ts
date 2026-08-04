import type { UninstallApi } from "@/modules/Uninstall";

export async function uninstallCommand(argv: string[], uninstall: UninstallApi): Promise<number> {
  const result = await uninstall.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
