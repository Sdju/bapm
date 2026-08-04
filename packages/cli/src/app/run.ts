import { coreIntegration } from "./integrations/core.ts";
import { help } from "./init/help.ts";
import { resolveCommand } from "./registry.ts";

export async function runCli(argv: string[]): Promise<number> {
  const [command = "help", ...rest] = argv;
  const handler = resolveCommand(command);

  if (handler) {
    return handler(rest);
  }

  console.error(`${coreIntegration.name}: unknown command "${command}"`);
  help.print();
  return 1;
}
