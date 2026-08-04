import { runInstall, formatInstallHelp, parseInstallArgs } from "./services/runInstall.ts";
import type { InstallDeps, InstallOptions, InstallResult } from "./types/install.types.ts";

export type { InstallDeps, InstallOptions, InstallResult };
export { formatInstallHelp, parseInstallArgs };

export function createInstall(deps?: InstallDeps) {
  const resolved: InstallDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };

  return {
    async run(options: InstallOptions): Promise<InstallResult> {
      return runInstall(resolved, options);
    },
    formatHelp(): string {
      return formatInstallHelp(resolved);
    },
  };
}

export type InstallApi = ReturnType<typeof createInstall>;
