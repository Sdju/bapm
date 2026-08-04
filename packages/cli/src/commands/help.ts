import type { HelpApi } from "@/modules/Help";

export async function helpCommand(argv: string[], help: HelpApi): Promise<number> {
  const topic = argv[0];
  help.print(topic);
  return 0;
}
