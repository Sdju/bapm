import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExecutableGrantEntry, ExecutableGrantSurface } from "./types.ts";

const CONFIG_FILENAME = "config.json";

export type UserExecutableStoreOptions = {
  /** Override config root (defaults to `~/.bapm`). */
  configRoot?: string;
  /** Alias for configRoot (Marketplace / acceptance). */
  configDir?: string;
};

export type UserExecutableGrants = {
  allow: Record<string, ExecutableGrantEntry>;
  deny: Record<string, ExecutableGrantEntry>;
  executables: {
    allow: Record<string, ExecutableGrantEntry>;
    deny: Record<string, ExecutableGrantEntry>;
  };
  /** True when config.json declared an `executables` key (even if empty). */
  present: boolean;
};

export type SaveUserExecutableGrantsOptions = UserExecutableStoreOptions & {
  allow?: Record<string, unknown>;
  deny?: Record<string, unknown>;
  executables?: {
    allow?: Record<string, unknown>;
    deny?: Record<string, unknown>;
  };
  packageName?: string;
  grant?: "allow" | "deny";
  executableType?: string;
};

/** Resolve config root: explicit override → `~/.bapm`. */
export function resolveUserConfigRoot(opts?: UserExecutableStoreOptions): string {
  if (opts?.configRoot) return opts.configRoot;
  if (opts?.configDir) return opts.configDir;
  return join(homedir(), ".bapm");
}

export function userConfigJsonPath(opts?: UserExecutableStoreOptions): string {
  return join(resolveUserConfigRoot(opts), CONFIG_FILENAME);
}

/**
 * Load user-local executables grants from `<configRoot>/config.json`.
 * Missing file → empty allow/deny (surface not present until keys exist).
 */
export function loadUserExecutableGrants(
  opts: UserExecutableStoreOptions = {},
): UserExecutableGrants {
  const path = userConfigJsonPath(opts);
  if (!existsSync(path)) {
    return emptyGrants();
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return emptyGrants();
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyGrants();
  }
  const bag = raw as Record<string, unknown>;
  const hasExecutablesKey = "executables" in bag && bag.executables !== undefined;
  const executables =
    bag.executables && typeof bag.executables === "object" && !Array.isArray(bag.executables)
      ? (bag.executables as Record<string, unknown>)
      : {};
  const allow = normalizeGrantMap(executables.allow);
  const deny = normalizeGrantMap(executables.deny);
  return {
    allow,
    deny,
    executables: { allow, deny },
    present: hasExecutablesKey,
  };
}

/** Alias preferred by acceptance helpers. */
export const loadUserExecutables = loadUserExecutableGrants;
export const loadExecutableUserGrants = loadUserExecutableGrants;
export const readUserExecutableGrants = loadUserExecutableGrants;

/**
 * Save user-local executables grants to `<configRoot>/config.json`.
 * Merges into existing JSON; prefers full `executables`/`allow`/`deny` bags,
 * or incremental `packageName` + `grant` + `executableType`.
 */
export function saveUserExecutableGrants(
  opts: SaveUserExecutableGrantsOptions,
): UserExecutableGrants {
  const path = userConfigJsonPath(opts);
  const root = dirname(path);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    try {
      chmodSync(root, 0o700);
    } catch {
      // Best-effort on platforms that ignore mode.
    }
  }

  let existing: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    } catch {
      existing = {};
    }
  }

  const current = loadUserExecutableGrants(opts);
  let allow = { ...current.allow };
  let deny = { ...current.deny };

  if (opts.executables?.allow !== undefined || opts.allow !== undefined) {
    allow = {
      ...allow,
      ...normalizeGrantMap(opts.executables?.allow ?? opts.allow),
    };
  }
  if (opts.executables?.deny !== undefined || opts.deny !== undefined) {
    deny = {
      ...deny,
      ...normalizeGrantMap(opts.executables?.deny ?? opts.deny),
    };
  }

  const packageName = opts.packageName?.trim();
  if (packageName && opts.grant) {
    const type = String(opts.executableType ?? "mcp").toLowerCase();
    const entry: ExecutableGrantEntry = { [type]: true };
    if (opts.grant === "allow") {
      allow = { ...allow, [packageName]: { ...allow[packageName], ...entry } };
      // Clear opposing deny for the same type when approving.
      if (deny[packageName]) {
        const next = { ...deny[packageName] };
        delete next[type];
        if (Object.keys(next).length === 0) {
          const { [packageName]: _, ...rest } = deny;
          deny = rest;
        } else {
          deny = { ...deny, [packageName]: next };
        }
      }
    } else {
      deny = { ...deny, [packageName]: { ...deny[packageName], ...entry } };
      if (allow[packageName]) {
        const next = { ...allow[packageName] };
        delete next[type];
        if (Object.keys(next).length === 0) {
          const { [packageName]: _, ...rest } = allow;
          allow = rest;
        } else {
          allow = { ...allow, [packageName]: next };
        }
      }
    }
  }

  const nextDoc = {
    ...existing,
    executables: { allow, deny },
  };
  writeFileSync(path, `${JSON.stringify(nextDoc, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best-effort.
  }

  return {
    allow,
    deny,
    executables: { allow, deny },
    present: true,
  };
}

/** Alias preferred by acceptance helpers. */
export const saveUserExecutables = saveUserExecutableGrants;
export const saveExecutableUserGrants = saveUserExecutableGrants;
export const writeUserExecutableGrants = saveUserExecutableGrants;
export const persistUserExecutableGrant = saveUserExecutableGrants;

/** Convert loaded user grants into a grant surface. */
export function userGrantsToSurface(
  grants: UserExecutableGrants,
  opts?: { present?: boolean },
): ExecutableGrantSurface {
  const hasEntries = Object.keys(grants.allow).length > 0 || Object.keys(grants.deny).length > 0;
  return {
    present: opts?.present ?? (grants.present === true || hasEntries),
    allow: grants.allow,
    deny: grants.deny,
  };
}

function emptyGrants(): UserExecutableGrants {
  return {
    allow: {},
    deny: {},
    executables: { allow: {}, deny: {} },
    present: false,
  };
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
