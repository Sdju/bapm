import type { LockApi } from "@/modules/Lock";

export async function lockCommand(argv: string[], lock: LockApi): Promise<number> {
  const result = await lock.run({ args: argv, cwd: process.cwd() });
  // Export path prints SBOM / diagnostics itself; skip duplicate message.
  const isExport = argv[0] === "export";
  if (result.ok) {
    if (result.message && !isExport) console.log(result.message);
    return 0;
  }
  if (result.message && !isExport) console.error(result.message);
  return result.exitCode || 1;
}
