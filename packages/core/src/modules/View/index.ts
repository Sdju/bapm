/**
 * View — offline local inspect of one installed lock package.
 *
 * Resolve query (same forms as deps why) → modules path → optional
 * package-manifest summary. No network / registry I/O.
 */

export type { ViewError, ViewIdentity, ViewPackageOptions, ViewPackageResult } from "./types.ts";

export { viewPackage, runView, viewLocalPackage, localView } from "./viewPackage.ts";
