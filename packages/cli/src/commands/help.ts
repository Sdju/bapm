import type { HelpApi } from "@/modules/Help";

export async function helpCommand(_argv: string[], help: HelpApi): Promise<number> {
  help.print();
  return 0;
}
