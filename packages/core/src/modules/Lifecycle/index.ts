/**
 * Lifecycle — detect `lifecycle:` declarations that bapm cannot execute.
 *
 * ## Public API
 *
 * - `detectLifecycleUnsupported` / `collectLifecycleUnsupported`
 * - `hasLifecycleDeclaration`
 *
 * ## Example
 *
 * ```ts
 * import { detectLifecycleUnsupported } from "@/modules/Lifecycle";
 * const diagnostics = detectLifecycleUnsupported({ rootManifest, nodes });
 * ```
 */

export type { DetectLifecycleUnsupportedOptions, LifecycleUnsupportedDiagnostic } from "./types.ts";
export {
  collectLifecycleUnsupported,
  detectLifecycleUnsupported,
  hasLifecycleDeclaration,
} from "./detect.ts";
