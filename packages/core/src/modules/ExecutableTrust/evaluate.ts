import type {
  EvaluateExecutableTrustOptions,
  ExecutableGrantEntry,
  ExecutableGrantSurface,
  ExecutableTrustDecision,
  ParseExecutableGrantsOptions,
} from "./types.ts";

/**
 * True when the consuming project declared a grant surface
 * (`executables.allow` / `allowExecutables`), including an empty allow map.
 */
export function hasGrantSurface(
  surface: ExecutableGrantSurface | { present?: boolean } | null | undefined,
): boolean {
  if (!surface) return false;
  if (typeof surface.present === "boolean") return surface.present;
  return false;
}

/**
 * Parse grant vocabulary from a manifest document.
 * Preferred: `executables.allow` / `executables.deny`.
 * Alias: top-level `allowExecutables` (OpenAPM text drop-in).
 */
export function parseExecutableGrants(
  input: ParseExecutableGrantsOptions | Record<string, unknown> = {},
): ExecutableGrantSurface {
  const bag =
    "manifest" in input || "executables" in input || "allowExecutables" in input
      ? (input as ParseExecutableGrantsOptions)
      : { manifest: input as Record<string, unknown> };

  const manifest = (bag.manifest ?? {}) as Record<string, unknown>;
  const executables = bag.executables ?? manifest.executables;
  const allowAlias = bag.allowExecutables ?? manifest.allowExecutables;

  let present = false;
  let allow: Record<string, ExecutableGrantEntry> = {};
  let deny: Record<string, ExecutableGrantEntry> = {};

  if (executables !== undefined && executables !== null) {
    present = true;
    if (typeof executables === "object" && !Array.isArray(executables)) {
      const ex = executables as Record<string, unknown>;
      if ("allow" in ex) {
        allow = normalizeGrantMap(ex.allow);
      }
      if ("deny" in ex) {
        deny = normalizeGrantMap(ex.deny);
      }
    }
  }

  if (allowAlias !== undefined && allowAlias !== null) {
    present = true;
    allow = { ...allow, ...normalizeGrantMap(allowAlias) };
  }

  return { present, allow, deny };
}

/**
 * Evaluate whether a package may deploy an executable type (default: mcp).
 * When grant surface is absent → skip (caller decides direct-only / trust-transitive).
 * When present + unapproved → withhold / deny (fail-closed).
 */
export function evaluateExecutableTrust(
  options: EvaluateExecutableTrustOptions,
): ExecutableTrustDecision {
  const packageName = String(options.packageName ?? "").trim();
  const executableType = String(options.executableType ?? options.type ?? "mcp").toLowerCase();
  const surface = normalizeSurface(options.grantSurface);

  if (!surface.present) {
    return {
      allowed: true,
      outcome: "skip",
      packageName,
      executableType,
      reason: "no grant surface",
    };
  }

  if (isDenied(surface.deny[packageName], executableType)) {
    return {
      allowed: false,
      outcome: "deny",
      packageName,
      executableType,
      reason: `package "${packageName}" denied for ${executableType}`,
      withhold: true,
      unapproved: true,
    };
  }

  if (isApproved(surface.allow[packageName], executableType)) {
    return {
      allowed: true,
      outcome: "allow",
      packageName,
      executableType,
      reason: `package "${packageName}" approved for ${executableType}`,
    };
  }

  return {
    allowed: false,
    outcome: "withhold",
    packageName,
    executableType,
    reason: `unapproved ${executableType} from dependency "${packageName}" withheld (executables.allow / allowExecutables)`,
    withhold: true,
    unapproved: true,
  };
}

/** Alias preferred by acceptance helpers. */
export const evaluateMcpExecutableTrust = evaluateExecutableTrust;
/** Alias preferred by design docs. */
export const gateExecutableMcp = evaluateExecutableTrust;
/** Alias preferred by acceptance helpers. */
export const checkExecutableTrust = evaluateExecutableTrust;

function normalizeSurface(
  raw: EvaluateExecutableTrustOptions["grantSurface"],
): ExecutableGrantSurface {
  if (!raw) return { present: false, allow: {}, deny: {} };
  if ("present" in raw && typeof raw.present === "boolean") {
    return {
      present: raw.present,
      allow: normalizeGrantMap(raw.allow),
      deny: normalizeGrantMap(raw.deny),
    };
  }
  // Acceptance helper shape: `{ allow: {} }` implies present grant surface.
  if (raw.allow !== undefined || raw.deny !== undefined) {
    return {
      present: true,
      allow: normalizeGrantMap(raw.allow),
      deny: normalizeGrantMap(raw.deny),
    };
  }
  return { present: false, allow: {}, deny: {} };
}

function normalizeGrantMap(value: unknown): Record<string, ExecutableGrantEntry> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, ExecutableGrantEntry> = {};
  for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!name) continue;
    if (entry === true) {
      out[name] = { mcp: true };
      continue;
    }
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      out[name] = entry as ExecutableGrantEntry;
      continue;
    }
    if (entry === false) {
      out[name] = { mcp: false };
    }
  }
  return out;
}

function isApproved(entry: ExecutableGrantEntry | undefined, type: string): boolean {
  if (!entry) return false;
  if (type in entry) return Boolean(entry[type]);
  if (type === "mcp" && "mcp" in entry) return Boolean(entry.mcp);
  // Bare `{ mcp: true }` or truthy type key
  return false;
}

function isDenied(entry: ExecutableGrantEntry | undefined, type: string): boolean {
  if (!entry) return false;
  if (type in entry) return entry[type] === true || entry[type] === "deny";
  if (type === "mcp" && entry.mcp === false) return true;
  return false;
}
