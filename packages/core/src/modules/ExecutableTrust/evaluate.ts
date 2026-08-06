import type {
  EvaluateExecutableTrustOptions,
  ExecutableGrantEntry,
  ExecutableGrantSurface,
  ExecutableTrustDecision,
  GrantSurfaceInput,
  OrgExecutables,
  ParseExecutableGrantsOptions,
  ResolveExecutableTrustOptions,
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
 * Layered deny-wins resolver (sc-011):
 * org deny_all / org deny → project|user deny → project allow → user allow →
 * withhold if any grant surface present else skip.
 */
export function resolveExecutableTrust(
  options: ResolveExecutableTrustOptions,
): ExecutableTrustDecision {
  const packageName = String(options.packageName ?? "").trim();
  const executableType = String(options.executableType ?? options.type ?? "mcp").toLowerCase();
  const org = normalizeOrg(options.orgExecutables);
  const project = normalizeSurface(options.projectSurface ?? options.grantSurface);
  const user = normalizeSurface(options.userSurface);
  const anySurface = project.present || user.present;

  if (org.deny_all) {
    return {
      allowed: false,
      outcome: "deny",
      packageName,
      executableType,
      reason: `org policy deny_all blocks ${executableType} for "${packageName}"`,
      withhold: true,
      unapproved: true,
    };
  }

  if (org.deny.includes(packageName)) {
    return {
      allowed: false,
      outcome: "deny",
      packageName,
      executableType,
      reason: `org policy executables.deny blocks "${packageName}" for ${executableType}`,
      withhold: true,
      unapproved: true,
    };
  }

  if (
    isDenied(project.deny[packageName], executableType) ||
    isDenied(user.deny[packageName], executableType)
  ) {
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

  if (isApproved(project.allow[packageName], executableType)) {
    return {
      allowed: true,
      outcome: "allow",
      packageName,
      executableType,
      reason: `package "${packageName}" approved for ${executableType} (project)`,
    };
  }

  if (isApproved(user.allow[packageName], executableType)) {
    return {
      allowed: true,
      outcome: "allow",
      packageName,
      executableType,
      reason: `package "${packageName}" approved for ${executableType} (user)`,
    };
  }

  if (!anySurface) {
    return {
      allowed: true,
      outcome: "skip",
      packageName,
      executableType,
      reason: "no grant surface",
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

/** Audit/trust classifier twin — identical to resolveExecutableTrust (sc-011). */
export const classifyExecutableTrust = resolveExecutableTrust;

/**
 * Evaluate whether a package may deploy an executable type (default: mcp).
 * Project-grant-only thin wrapper over `resolveExecutableTrust` (sc-009).
 */
export function evaluateExecutableTrust(
  options: EvaluateExecutableTrustOptions,
): ExecutableTrustDecision {
  return resolveExecutableTrust({
    packageName: options.packageName,
    executableType: options.executableType ?? options.type,
    projectSurface: options.grantSurface,
    userSurface: { present: false, allow: {}, deny: {} },
    orgExecutables: { deny_all: false, deny: [] },
  });
}

/** Alias preferred by acceptance helpers. */
export const evaluateMcpExecutableTrust = evaluateExecutableTrust;
/** Alias preferred by design docs. */
export const gateExecutableMcp = evaluateExecutableTrust;
/** Alias preferred by acceptance helpers. */
export const checkExecutableTrust = evaluateExecutableTrust;

export function normalizeSurface(raw: GrantSurfaceInput): ExecutableGrantSurface {
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

function normalizeOrg(raw: OrgExecutables | null | undefined): {
  deny_all: boolean;
  deny: string[];
} {
  if (!raw || typeof raw !== "object") return { deny_all: false, deny: [] };
  const deny = Array.isArray(raw.deny)
    ? raw.deny.filter((x): x is string => typeof x === "string")
    : [];
  return { deny_all: raw.deny_all === true, deny };
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
  return false;
}

function isDenied(entry: ExecutableGrantEntry | undefined, type: string): boolean {
  if (!entry) return false;
  if (type in entry) return entry[type] === true || entry[type] === "deny";
  if (type === "mcp" && entry.mcp === false) return true;
  return false;
}
