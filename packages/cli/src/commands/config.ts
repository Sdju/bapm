import type { ConfigApi } from "@/modules/Config";

export async function configCommand(argv: string[], config: ConfigApi): Promise<number> {
  const result = await config.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
