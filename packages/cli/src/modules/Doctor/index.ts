import { formatDoctorHelp, parseDoctorArgs, runDoctorCli } from "./services/runDoctor.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatDoctorHelp, parseDoctorArgs };

export function createDoctor(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runDoctorCli(resolved, options);
    },
    formatHelp(): string {
      return formatDoctorHelp(resolved);
    },
  };
}

export type DoctorApi = ReturnType<typeof createDoctor>;
