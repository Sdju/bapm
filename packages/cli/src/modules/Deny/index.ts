/**
 * Deny — interactive user-local executable deny (sc-010).
 *
 * Writes only to ~/.bapm/config.json; never project bapm.yml.
 */
import { formatDenyHelp, parseDenyArgs, runDenyCli, type DenyCliDeps } from "./services/runDeny.ts";
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { DenyCliDeps, LifecycleResult };
export { formatDenyHelp, parseDenyArgs };

export function createDeny(deps?: Partial<DenyCliDeps>) {
  const resolved: DenyCliDeps = {
    name: deps?.name ?? "bapm",
    manifestFile: deps?.manifestFile ?? "bapm.yml",
    saveGrant: deps?.saveGrant,
  };
  return {
    async run(options: { args?: string[]; cwd?: string } = {}): Promise<LifecycleResult> {
      return runDenyCli(resolved, options);
    },
    formatHelp(): string {
      return formatDenyHelp(resolved);
    },
  };
}

export type DenyApi = ReturnType<typeof createDeny>;
