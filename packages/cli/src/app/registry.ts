import { COMMAND_HELP, COMMAND_INSTALL, COMMAND_VERSION } from "@/common/constants/commands.ts";
import { helpCommand } from "@/commands/help.ts";
import { installCommand } from "@/commands/install.ts";
import { versionCommand } from "@/commands/version.ts";
import { help } from "./init/help.ts";
import { install } from "./init/install.ts";
import { version } from "./init/version.ts";

export type CommandHandler = (argv: string[]) => Promise<number>;

const handlers: Record<string, CommandHandler> = {
  [COMMAND_HELP]: (argv) => helpCommand(argv, help),
  [COMMAND_VERSION]: (argv) => versionCommand(argv, version),
  [COMMAND_INSTALL]: (argv) => installCommand(argv, install),
  "-h": (argv) => helpCommand(argv, help),
  "--help": (argv) => helpCommand(argv, help),
  "-V": (argv) => versionCommand(argv, version),
  "--version": (argv) => versionCommand(argv, version),
};

export function resolveCommand(name: string): CommandHandler | undefined {
  return handlers[name];
}
