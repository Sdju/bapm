/**
 * Per-invocation trust-bin consent overlay on resolveExecutableTrust(type=bin).
 * Design: install-trust-bin D1–D2.
 */
import { resolveExecutableTrust } from "./evaluate.ts";
import type {
  ExecutableTrustDecision,
  GrantSurfaceInput,
  OrgExecutables,
  ResolveExecutableTrustOptions,
} from "./types.ts";

export type TrustBinMode = "allow" | "deny" | "default";

export type ResolveBinDeployConsentOptions = {
  packageName: string;
  /** Invocation consent: `--trust-bin` → allow, `--no-trust-bin` → deny, neither → default. */
  trustBin?: TrustBinMode;
  /**
   * Explicit interactive signal (tests / callers). When unset, derived from
   * CI / BAPM_NON_INTERACTIVE / frozen / stdin TTY (D2).
   */
  isInteractive?: boolean;
  frozen?: boolean;
  env?: Record<string, string | undefined>;
  /** Injectable stdin TTY; defaults to `process.stdin.isTTY`. */
  stdinIsTTY?: boolean;
  orgExecutables?: OrgExecutables | null;
  projectSurface?: GrantSurfaceInput;
  userSurface?: GrantSurfaceInput;
  grantSurface?: GrantSurfaceInput;
  /** Precomputed ladder decision (skips resolveExecutableTrust). */
  ladder?: ExecutableTrustDecision;
};

export type BinDeployConsentDecision = {
  deploy: boolean;
  withhold: boolean;
  warn: boolean;
  allowed: boolean;
  outcome: "deploy" | "withhold" | "skip";
  ladderOutcome: ExecutableTrustDecision["outcome"];
  packageName: string;
  executableType: "bin";
  reason?: string;
  trustBin: TrustBinMode;
  interactive: boolean;
};

/**
 * Effective bin-deploy decision: ExecutableTrust deny-wins for `bin`, then
 * invocation overlay. Flags cannot invent allow when the ladder denies/withholds.
 */
export function resolveBinDeployConsent(
  options: ResolveBinDeployConsentOptions,
): BinDeployConsentDecision {
  const packageName = String(options.packageName ?? "").trim();
  const trustBin = normalizeTrustBin(options.trustBin);
  const interactive = resolveIsInteractive(options);
  const ladder =
    options.ladder ??
    resolveExecutableTrust({
      packageName,
      executableType: "bin",
      orgExecutables: options.orgExecutables,
      projectSurface: options.projectSurface ?? options.grantSurface,
      userSurface: options.userSurface,
      grantSurface: options.grantSurface,
    } satisfies ResolveExecutableTrustOptions);

  const base = {
    packageName,
    executableType: "bin" as const,
    ladderOutcome: ladder.outcome,
    trustBin,
    interactive,
  };

  // Ladder deny/withhold always wins (including over --trust-bin).
  if (!ladder.allowed || ladder.outcome === "deny" || ladder.outcome === "withhold") {
    return {
      ...base,
      deploy: false,
      withhold: true,
      warn: false,
      allowed: false,
      outcome: "withhold",
      reason:
        ladder.reason ??
        `bin deploy withheld for "${packageName}" (ExecutableTrust ${ladder.outcome})`,
    };
  }

  if (trustBin === "deny") {
    return {
      ...base,
      deploy: false,
      withhold: true,
      warn: false,
      allowed: false,
      outcome: "withhold",
      reason: `bin deploy skipped for "${packageName}" (--no-trust-bin / trustBin=deny)`,
    };
  }

  if (trustBin === "allow") {
    return {
      ...base,
      deploy: true,
      withhold: false,
      warn: false,
      allowed: true,
      outcome: "deploy",
      reason: `bin deploy allowed for "${packageName}" (--trust-bin)`,
    };
  }

  // trustBin === "default"
  if (interactive) {
    return {
      ...base,
      deploy: true,
      withhold: false,
      warn: true,
      allowed: true,
      outcome: "deploy",
      reason: `interactive default deploys bin for "${packageName}"; pass --trust-bin for explicit consent`,
    };
  }

  // Non-interactive default: require explicit project/user allow (not skip).
  if (ladder.outcome === "allow") {
    return {
      ...base,
      deploy: true,
      withhold: false,
      warn: false,
      allowed: true,
      outcome: "deploy",
      reason: `bin deploy allowed for "${packageName}" (persisted grant; non-interactive)`,
    };
  }

  return {
    ...base,
    deploy: false,
    withhold: true,
    warn: false,
    allowed: false,
    outcome: "withhold",
    reason: `bin deploy skipped for "${packageName}" (non-interactive default without --trust-bin or persisted bin allow)`,
  };
}

/** Alias preferred by design / acceptance discovery. */
export const resolveEffectiveBinDeploy = resolveBinDeployConsent;
export const evaluateBinDeployConsent = resolveBinDeployConsent;

export function normalizeTrustBin(value: unknown): TrustBinMode {
  if (value === "allow" || value === "deny" || value === "default") return value;
  return "default";
}

export function resolveIsInteractive(options: {
  isInteractive?: boolean;
  frozen?: boolean;
  env?: Record<string, string | undefined>;
  stdinIsTTY?: boolean;
}): boolean {
  if (typeof options.isInteractive === "boolean") return options.isInteractive;
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  if (isTruthyEnvFlag(env.CI)) return false;
  if (isTruthyEnvFlag(env.BAPM_NON_INTERACTIVE)) return false;
  if (options.frozen === true) return false;
  const tty =
    typeof options.stdinIsTTY === "boolean" ? options.stdinIsTTY : Boolean(process.stdin.isTTY);
  return tty;
}

/** Same truthiness as Install `isCiEnvTruthy` (avoid Install↔ExecutableTrust import cycle). */
function isTruthyEnvFlag(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "" || normalized === "0" || normalized === "false") return false;
  return true;
}
