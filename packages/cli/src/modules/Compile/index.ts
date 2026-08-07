import { formatCompileHelp, parseCompileArgs, runCompileCli } from "./services/runCompile.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";
import type { TargetRegistry } from "bapm-integration-api";

export type { LifecycleCliDeps, LifecycleResult };
export { formatCompileHelp, parseCompileArgs };

export function createCompile(deps?: LifecycleCliDeps, targetRegistry?: TargetRegistry) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runCompileCli(resolved, { ...options, targetRegistry });
    },
    formatHelp(): string {
      return formatCompileHelp(resolved);
    },
  };
}

export type CompileApi = ReturnType<typeof createCompile>;
