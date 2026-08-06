import {
  COMMAND_APPROVE,
  COMMAND_AUDIT,
  COMMAND_CACHE,
  COMMAND_COMPILE,
  COMMAND_DENY,
  COMMAND_DEPS,
  COMMAND_DOCTOR,
  COMMAND_HELP,
  COMMAND_INIT,
  COMMAND_INSTALL,
  COMMAND_LOCK,
  COMMAND_MARKETPLACE,
  COMMAND_OUTDATED,
  COMMAND_PACK,
  COMMAND_PLUGIN,
  COMMAND_POLICY,
  COMMAND_PRUNE,
  COMMAND_PUBLISH,
  COMMAND_SEARCH,
  COMMAND_FIND,
  COMMAND_SELF_UPDATE,
  COMMAND_UNINSTALL,
  COMMAND_UPDATE,
  COMMAND_VERSION,
} from "@/common/constants/commands.ts";
import { approveCommand } from "@/commands/approve.ts";
import { auditCommand } from "@/commands/audit.ts";
import { cacheCommand } from "@/commands/cache.ts";
import { compileCommand } from "@/commands/compile.ts";
import { denyCommand } from "@/commands/deny.ts";
import { depsCommand } from "@/commands/deps.ts";
import { doctorCommand } from "@/commands/doctor.ts";
import { findCommand } from "@/commands/find.ts";
import { helpCommand } from "@/commands/help.ts";
import { initCommand } from "@/commands/init.ts";
import { installCommand } from "@/commands/install.ts";
import { lockCommand } from "@/commands/lock.ts";
import { marketplaceCommand } from "@/commands/marketplace.ts";
import { outdatedCommand } from "@/commands/outdated.ts";
import { packCommand } from "@/commands/pack.ts";
import { pluginCommand } from "@/commands/plugin.ts";
import { policyCommand } from "@/commands/policy.ts";
import { pruneCommand } from "@/commands/prune.ts";
import { publishCommand } from "@/commands/publish.ts";
import { searchCommand } from "@/commands/search.ts";
import { selfUpdateCommand } from "@/commands/self-update.ts";
import { uninstallCommand } from "@/commands/uninstall.ts";
import { updateCommand } from "@/commands/update.ts";
import { versionCommand } from "@/commands/version.ts";
import { approve } from "./init/approve.ts";
import { audit } from "./init/audit.ts";
import { cache } from "./init/cache.ts";
import { compile } from "./init/compile.ts";
import { deny } from "./init/deny.ts";
import { deps } from "./init/deps.ts";
import { doctor } from "./init/doctor.ts";
import { find } from "./init/find.ts";
import { help } from "./init/help.ts";
import { init } from "./init/init.ts";
import { install } from "./init/install.ts";
import { lock } from "./init/lock.ts";
import { marketplace } from "./init/marketplace.ts";
import { outdated } from "./init/outdated.ts";
import { pack } from "./init/pack.ts";
import { plugin } from "./init/plugin.ts";
import { policy } from "./init/policy.ts";
import { prune } from "./init/prune.ts";
import { publish } from "./init/publish.ts";
import { search } from "./init/search.ts";
import { selfUpdate } from "./init/selfUpdate.ts";
import { uninstall } from "./init/uninstall.ts";
import { update } from "./init/update.ts";
import { version } from "./init/version.ts";

export type CommandHandler = (argv: string[]) => Promise<number>;

const handlers: Record<string, CommandHandler> = {
  [COMMAND_HELP]: (argv) => helpCommand(argv, help),
  [COMMAND_VERSION]: (argv) => versionCommand(argv, version),
  [COMMAND_INIT]: (argv) => initCommand(argv, init),
  [COMMAND_PLUGIN]: (argv) => pluginCommand(argv, plugin),
  [COMMAND_INSTALL]: (argv) => installCommand(argv, install),
  [COMMAND_PACK]: (argv) => packCommand(argv, pack),
  [COMMAND_PUBLISH]: (argv) => publishCommand(argv, publish),
  [COMMAND_SELF_UPDATE]: (argv) => selfUpdateCommand(argv, selfUpdate),
  [COMMAND_LOCK]: (argv) => lockCommand(argv, lock),
  [COMMAND_UPDATE]: (argv) => updateCommand(argv, update),
  [COMMAND_OUTDATED]: (argv) => outdatedCommand(argv, outdated),
  [COMMAND_UNINSTALL]: (argv) => uninstallCommand(argv, uninstall),
  [COMMAND_PRUNE]: (argv) => pruneCommand(argv, prune),
  [COMMAND_DEPS]: (argv) => depsCommand(argv, deps),
  [COMMAND_AUDIT]: (argv) => auditCommand(argv, audit),
  [COMMAND_DOCTOR]: (argv) => doctorCommand(argv, doctor),
  [COMMAND_COMPILE]: (argv) => compileCommand(argv, compile),
  [COMMAND_CACHE]: (argv) => cacheCommand(argv, cache),
  [COMMAND_POLICY]: (argv) => policyCommand(argv, policy),
  [COMMAND_APPROVE]: (argv) => approveCommand(argv, approve),
  [COMMAND_DENY]: (argv) => denyCommand(argv, deny),
  [COMMAND_MARKETPLACE]: (argv) => marketplaceCommand(argv, marketplace),
  [COMMAND_SEARCH]: (argv) => searchCommand(argv, search),
  [COMMAND_FIND]: (argv) => findCommand(argv, find),
  "-h": (argv) => helpCommand(argv, help),
  "--help": (argv) => helpCommand(argv, help),
  "-V": (argv) => versionCommand(argv, version),
  "--version": (argv) => versionCommand(argv, version),
};

export function resolveCommand(name: string): CommandHandler | undefined {
  return handlers[name];
}
