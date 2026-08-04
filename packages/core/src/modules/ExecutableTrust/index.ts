/**
 * ExecutableTrust — OpenAPM sc-009 grant parsing and MCP deploy gating.
 *
 * ## Public API
 *
 * - `parseExecutableGrants` — `executables.allow`/`deny` + `allowExecutables` alias
 * - `evaluateExecutableTrust` — approve / withhold for a package + executable type
 * - `hasGrantSurface` — non-absent grant surface detection
 *
 * ## Example
 *
 * ```ts
 * import { evaluateExecutableTrust, parseExecutableGrants } from "@/modules/ExecutableTrust";
 * const grants = parseExecutableGrants(manifest);
 * const decision = evaluateExecutableTrust({
 *   grantSurface: grants,
 *   packageName: "mcp-dep",
 *   executableType: "mcp",
 * });
 * ```
 */

export type {
  ExecutableGrantEntry,
  ExecutableGrantSurface,
  ExecutableTrustDecision,
  ExecutableTrustOutcome,
  EvaluateExecutableTrustOptions,
  ParseExecutableGrantsOptions,
} from "./types.ts";

export {
  evaluateExecutableTrust,
  evaluateMcpExecutableTrust,
  gateExecutableMcp,
  checkExecutableTrust,
  hasGrantSurface,
  parseExecutableGrants,
} from "./evaluate.ts";
