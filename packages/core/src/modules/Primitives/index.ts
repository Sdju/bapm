/**
 * Primitives — discover attributed agentic primitives and resolve conflicts (pr-001..003).
 *
 * ## Public API
 *
 * - `discoverPrimitives` — local `.apm/` + modules trees + root/skills SKILL.md
 * - `resolvePrimitiveConflicts` — local overrides deps; first-declared dep wins
 * - Types / `PrimitivesError`
 *
 * ## Example
 *
 * ```ts
 * import { discoverPrimitives, resolvePrimitiveConflicts } from "@/modules/Primitives";
 * const raw = discoverPrimitives({ cwd });
 * const { primitives, diagnostics } = resolvePrimitiveConflicts({ primitives: raw });
 * ```
 */

export type {
  AttributedPrimitive,
  DiscoverPrimitivesOptions,
  PrimitiveConflictDiagnostic,
  PrimitiveSource,
  PrimitiveType,
  ResolvePrimitiveConflictsOptions,
  ResolvePrimitiveConflictsResult,
} from "./types.ts";

export type { PrimitivesErrorCode } from "./errors.ts";
export { PrimitivesError } from "./errors.ts";

export { discoverPrimitives } from "./discover.ts";
export { resolvePrimitiveConflicts, resolveConflicts } from "./conflicts.ts";
