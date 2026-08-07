import type { ViewApi } from "@/modules/View";

export async function viewCommand(argv: string[], view: ViewApi): Promise<number> {
  const result = await view.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
