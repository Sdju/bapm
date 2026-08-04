import { resolveAndLock } from "@bapm/core";
import { createLock } from "@/modules/Lock";

export const lock = createLock({
  resolveAndLock: async (options) => {
    const result = await resolveAndLock(options);
    return { lockPath: result.lockPath };
  },
});
