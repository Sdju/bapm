import {
  formatPolicyHelp,
  formatPolicyStatusHelp,
  parsePolicyArgs,
  runPolicyCli,
} from "./services/runPolicy.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatPolicyHelp, formatPolicyStatusHelp, parsePolicyArgs };

export function createPolicy(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runPolicyCli(resolved, options);
    },
    formatHelp(): string {
      return formatPolicyHelp(resolved);
    },
    formatStatusHelp(): string {
      return formatPolicyStatusHelp(resolved);
    },
  };
}

export type PolicyApi = ReturnType<typeof createPolicy>;
