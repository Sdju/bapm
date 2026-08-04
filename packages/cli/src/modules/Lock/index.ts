import { runLock } from "./services/runLock.ts";
import type { LockDeps, LockOptions, LockResult } from "./types/lock.types.ts";

export type { LockDeps, LockOptions, LockResult };
export { parseLockArgs } from "./services/runLock.ts";

export function createLock(deps: LockDeps) {
  return {
    async run(options: LockOptions = {}): Promise<LockResult> {
      return runLock(deps, options);
    },
  };
}

export type LockApi = ReturnType<typeof createLock>;
