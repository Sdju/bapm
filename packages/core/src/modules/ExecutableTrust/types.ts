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

export type EvaluateExecutableTrustOptions = {
  /** Parsed surface or raw `{ allow }` bag accepted by acceptance helpers. */
  grantSurface?:
    | ExecutableGrantSurface
    | { allow?: Record<string, unknown>; deny?: Record<string, unknown>; present?: boolean }
    | null;
  packageName: string;
  executableType?: string;
  /** Alias for executableType. */
  type?: string;
};

export type ParseExecutableGrantsOptions = {
  /** Manifest document (or bag with executables / allowExecutables). */
  manifest?: Record<string, unknown>;
  /** Direct grant bag when manifest is not passed. */
  executables?: unknown;
  allowExecutables?: unknown;
};
