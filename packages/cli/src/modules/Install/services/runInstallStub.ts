import type { InstallDeps, InstallOptions, InstallResult } from "../types/install.types.ts";

export async function runInstallStub(
  deps: InstallDeps,
  options: InstallOptions,
): Promise<InstallResult> {
  const rest = options.args;
  console.error(`${deps.name}: "install" is not implemented yet (args: ${rest.join(" ") || "—"})`);
  console.error(`Expected manifest: ${deps.manifestFile}, lock: ${deps.lockFile}`);
  return { ok: false };
}
