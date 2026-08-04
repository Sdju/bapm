import { runInstallStub } from "./services/runInstallStub.ts";
import type { InstallDeps, InstallOptions, InstallResult } from "./types/install.types.ts";

export type { InstallDeps, InstallOptions, InstallResult };

export function createInstall(deps?: InstallDeps) {
  const resolved: InstallDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };

  return {
    async run(options: InstallOptions): Promise<InstallResult> {
      return runInstallStub(resolved, options);
    },
  };
}

export type InstallApi = ReturnType<typeof createInstall>;
