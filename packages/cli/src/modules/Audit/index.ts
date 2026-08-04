import { formatAuditHelp, parseAuditArgs, runAuditCli } from "./services/runAudit.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatAuditHelp, parseAuditArgs };

export function createAudit(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runAuditCli(resolved, options);
    },
    formatHelp(): string {
      return formatAuditHelp(resolved);
    },
  };
}

export type AuditApi = ReturnType<typeof createAudit>;
