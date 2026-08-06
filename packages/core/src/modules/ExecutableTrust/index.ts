/**
 * ExecutableTrust — OpenAPM sc-009/010/011/012 grant parsing, user store,
 * layered deny-wins resolve, and lockfile require presence.
 *
 * ## Public API
 *
 * - `parseExecutableGrants` — `executables.allow`/`deny` + `allowExecutables` alias
 * - `resolveExecutableTrust` / `classifyExecutableTrust` — org + project + user deny-wins
 * - `evaluateExecutableTrust` — project-only thin wrapper (sc-009)
 * - `loadUserExecutableGrants` / `saveUserExecutableGrants` — `~/.bapm/config.json`
 * - `evaluateRequiredPackagePresence` — lock presence + distinct withheld (sc-012)
 * - `hasGrantSurface` — non-absent grant surface detection
 *
 * ## Example
 *
 * ```ts
 * import {
 *   resolveExecutableTrust,
 *   parseExecutableGrants,
 *   loadUserExecutableGrants,
 * } from "@/modules/ExecutableTrust";
 * const project = parseExecutableGrants(manifest);
 * const user = loadUserExecutableGrants({ configRoot });
 * const decision = resolveExecutableTrust({
 *   packageName: "mcp-dep",
 *   executableType: "mcp",
 *   orgExecutables: { deny_all: false, deny: [] },
 *   projectSurface: project,
 *   userSurface: { present: true, allow: user.allow, deny: user.deny },
 * });
 * ```
 */

export type {
  ExecutableGrantEntry,
  ExecutableGrantSurface,
  ExecutableTrustDecision,
  ExecutableTrustOutcome,
  EvaluateExecutableTrustOptions,
  EvaluateRequiredPackagePresenceOptions,
  EvaluateRequiredPackagePresenceResult,
  GrantSurfaceInput,
  OrgExecutables,
  ParseExecutableGrantsOptions,
  RequiredPackagePresenceDiagnostic,
  RequiredPackageTrustOutcome,
  ResolveExecutableTrustOptions,
} from "./types.ts";

export type {
  SaveUserExecutableGrantsOptions,
  UserExecutableGrants,
  UserExecutableStoreOptions,
} from "./userStore.ts";

export {
  evaluateExecutableTrust,
  evaluateMcpExecutableTrust,
  gateExecutableMcp,
  checkExecutableTrust,
  hasGrantSurface,
  parseExecutableGrants,
  resolveExecutableTrust,
  classifyExecutableTrust,
  normalizeSurface,
} from "./evaluate.ts";

export {
  loadUserExecutableGrants,
  loadUserExecutables,
  loadExecutableUserGrants,
  readUserExecutableGrants,
  saveUserExecutableGrants,
  saveUserExecutables,
  saveExecutableUserGrants,
  writeUserExecutableGrants,
  persistUserExecutableGrant,
  resolveUserConfigRoot,
  userConfigJsonPath,
  userGrantsToSurface,
} from "./userStore.ts";

export {
  evaluateRequiredPackagePresence,
  classifyRequiredPackagePresence,
  evaluateRequireLockPresence,
  evaluateRequiredPackagesFromLock,
} from "./presence.ts";
