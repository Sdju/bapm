/** Grant entry for one package under allow/deny. */
export type ExecutableGrantEntry = {
  mcp?: boolean;
  [key: string]: unknown;
};

/**
 * Parsed grant surface. `present` is true when the consuming manifest declared
 * `executables.allow` / `allowExecutables` (even if empty).
 */
export type ExecutableGrantSurface = {
  present: boolean;
  allow: Record<string, ExecutableGrantEntry>;
  deny: Record<string, ExecutableGrantEntry>;
};

export type ExecutableTrustOutcome = "allow" | "withhold" | "deny" | "skip";

export type ExecutableTrustDecision = {
  allowed: boolean;
  outcome: ExecutableTrustOutcome;
  packageName: string;
  executableType: string;
  reason?: string;
  withhold?: boolean;
  unapproved?: boolean;
};

export type GrantSurfaceInput =
  | ExecutableGrantSurface
  | { allow?: Record<string, unknown>; deny?: Record<string, unknown>; present?: boolean }
  | null
  | undefined;

export type OrgExecutables = {
  deny_all?: boolean;
  deny?: string[];
};

export type EvaluateExecutableTrustOptions = {
  /** Parsed surface or raw `{ allow }` bag accepted by acceptance helpers. */
  grantSurface?: GrantSurfaceInput;
  packageName: string;
  executableType?: string;
  /** Alias for executableType. */
  type?: string;
};

/** Layered deny-wins options (sc-011): org + project + user. */
export type ResolveExecutableTrustOptions = {
  packageName: string;
  executableType?: string;
  type?: string;
  orgExecutables?: OrgExecutables | null;
  projectSurface?: GrantSurfaceInput;
  userSurface?: GrantSurfaceInput;
  /** Back-compat alias → projectSurface. */
  grantSurface?: GrantSurfaceInput;
};

export type ParseExecutableGrantsOptions = {
  /** Manifest document (or bag with executables / allowExecutables). */
  manifest?: Record<string, unknown>;
  /** Direct grant bag when manifest is not passed. */
  executables?: unknown;
  allowExecutables?: unknown;
};

/** Lockfile-presence require evaluation (sc-012). */
export type RequiredPackageTrustOutcome = {
  outcome?: string;
  allowed?: boolean;
  withhold?: boolean;
  [key: string]: unknown;
};

export type EvaluateRequiredPackagePresenceOptions = {
  require?: string[];
  lockPackageIds?: string[];
  trustByPackage?: Record<string, RequiredPackageTrustOutcome>;
};

export type RequiredPackagePresenceDiagnostic = {
  code: string;
  message: string;
  identity?: string;
};

export type EvaluateRequiredPackagePresenceResult = {
  ok: boolean;
  satisfied: boolean;
  diagnostics: RequiredPackagePresenceDiagnostic[];
  violations: RequiredPackagePresenceDiagnostic[];
  codes: string[];
};
