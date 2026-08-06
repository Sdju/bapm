/**
 * Approve — interactive user-local executable allow (sc-010).
 *
 * Writes only to ~/.bapm/config.json; never project bapm.yml.
 */
import {
  formatApproveHelp,
  parseApproveArgs,
  runApproveCli,
  type ApproveCliDeps,
} from "./services/runApprove.ts";
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { ApproveCliDeps, LifecycleResult };
export { formatApproveHelp, parseApproveArgs };

export function createApprove(deps?: Partial<ApproveCliDeps>) {
  const resolved: ApproveCliDeps = {
    name: deps?.name ?? "bapm",
    manifestFile: deps?.manifestFile ?? "bapm.yml",
    saveGrant: deps?.saveGrant,
  };
  return {
    async run(options: { args?: string[]; cwd?: string } = {}): Promise<LifecycleResult> {
      return runApproveCli(resolved, options);
    },
    formatHelp(): string {
      return formatApproveHelp(resolved);
    },
  };
}

export type ApproveApi = ReturnType<typeof createApprove>;
