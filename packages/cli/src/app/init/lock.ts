import { exportSbom, resolveAndLock } from "@b-apm/core";
import { createLock } from "@/modules/Lock";

export const lock = createLock({
  resolveAndLock: async (options) => {
    const result = await resolveAndLock(options);
    return { lockPath: result.lockPath };
  },
  exportSbom: async (options) => {
    const result = await exportSbom(options);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, json: result.json, format: result.format };
  },
});
