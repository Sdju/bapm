/**
 * Uninstall — remove named deps from manifest, modules, deploy inventory, lock.
 */

export type { RunUninstallOptions, UninstallResult } from "./types.ts";
export { UninstallError } from "./errors.ts";
export type { UninstallErrorCode } from "./errors.ts";
export { runUninstall, uninstallPackages, uninstall } from "./runUninstall.ts";
