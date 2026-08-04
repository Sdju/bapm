import {
  formatUninstallHelp,
  parseUninstallArgs,
  runUninstallCli,
} from "./services/runUninstall.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatUninstallHelp, parseUninstallArgs };

export function createUninstall(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runUninstallCli(resolved, options);
    },
    formatHelp(): string {
      return formatUninstallHelp(resolved);
    },
  };
}

export type UninstallApi = ReturnType<typeof createUninstall>;
