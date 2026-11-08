import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import {
  resolveUserConfigRoot,
  userConfigJsonPath,
  type UserExecutableStoreOptions,
} from "@b-apm/core";

export type UserConfigStoreOptions = UserExecutableStoreOptions;

export type UserConfigDocument = Record<string, unknown>;

/** Resolve `~/.bapm` (or an injected config root). */
export function resolveConfigRoot(options?: UserConfigStoreOptions): string {
  return resolveUserConfigRoot(options);
}

export function userConfigPath(options?: UserConfigStoreOptions): string {
  return userConfigJsonPath(options);
}

/**
 * Read the whole user config document. Missing, malformed, or non-object JSON
 * returns `{}` so CLI commands fail closed without corrupting the file.
 */
export function loadUserConfig(options: UserConfigStoreOptions = {}): UserConfigDocument {
  const path = userConfigPath(options);
  if (!existsSync(path)) return {};
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as UserConfigDocument;
    }
  } catch {
    // Treat unreadable config as empty; a later write re-creates valid JSON.
  }
  return {};
}

/** Value at a dotted path (`target`, `executables.allow`, …). */
export function getConfigValue(document: UserConfigDocument, key: string): unknown {
  const parts = key.split(".").filter(Boolean);
  let current: unknown = document;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Immutable-ish dotted set. Supports the `target` key used by this release. */
export function setConfigValue(
  document: UserConfigDocument,
  key: string,
  value: unknown,
): UserConfigDocument {
  const parts = key.split(".").filter(Boolean);
  if (parts.length === 0) return document;
  const next: UserConfigDocument = { ...document };
  let cursor = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    const child = cursor[part];
    const clone =
      child && typeof child === "object" && !Array.isArray(child)
        ? { ...(child as Record<string, unknown>) }
        : {};
    cursor[part] = clone;
    cursor = clone as UserConfigDocument;
  }
  cursor[parts[parts.length - 1]!] = value;
  return next;
}

/** Immutable-ish dotted unset. Missing keys are a no-op. */
export function unsetConfigValue(document: UserConfigDocument, key: string): UserConfigDocument {
  const parts = key.split(".").filter(Boolean);
  if (parts.length === 0) return document;
  const next: UserConfigDocument = { ...document };
  let cursor = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    const child = cursor[part];
    if (!child || typeof child !== "object" || Array.isArray(child)) return document;
    const clone = { ...(child as Record<string, unknown>) };
    cursor[part] = clone;
    cursor = clone as UserConfigDocument;
  }
  delete cursor[parts[parts.length - 1]!];
  return next;
}

/** Read the persisted `target` default, when present and non-empty. */
export function readConfiguredTarget(options?: UserConfigStoreOptions): string | undefined {
  const value = getConfigValue(loadUserConfig(options), "target");
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * Write the config atomically (temp file + rename in the same directory) while
 * preserving every existing key, including `executables.allow` / `deny`.
 */
export function writeUserConfig(
  document: UserConfigDocument,
  options: UserConfigStoreOptions = {},
): string {
  const path = userConfigPath(options);
  const root = dirname(path);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    try {
      chmodSync(root, 0o700);
    } catch {
      // Best-effort on platforms that ignore mode.
    }
  }

  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(document, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temp, path);
  } catch (error) {
    try {
      rmSync(temp, { force: true });
    } catch {
      // Best-effort cleanup.
    }
    throw error;
  }
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best-effort.
  }
  return path;
}
