/**
 * Shared deploy-root and user-scope path helpers for host integrations.
 */

import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

/** Normalize a configured deploy root to POSIX separators without `./` or trailing `/`. */
function normalizeDeployRoot(root: string): string {
  const value = String(root ?? "")
    .trim()
    .replace(/\\/g, "/");
  if (value === "" || value === "." || value === "./") return ".";
  return value.replace(/^\.\//, "").replace(/\/+/g, "/").replace(/\/+$/, "");
}

/**
 * True when a required deploy root is present in the declared set.
 *
 * A root counts as present when it is declared exactly or when a declared root
 * is nested beneath it (e.g. `.agents/skills` satisfies `.agents`). Matching is
 * segment-aware, so `.cursor` never matches `.cursorrules`.
 */
export function hasDeployRoot(deployRoots: readonly string[], root: string): boolean {
  const required = normalizeDeployRoot(root);
  return deployRoots.some((candidate) => {
    const declared = normalizeDeployRoot(String(candidate));
    if (required === ".") return declared === ".";
    return declared === required || declared.startsWith(`${required}/`);
  });
}

/**
 * Throw when any required deploy root is missing from the declared set.
 * The message matches the historical per-host wording.
 */
export function requireDeployRoots(
  deployRoots: readonly string[],
  required: readonly string[],
  label: string,
): void {
  for (const root of required) {
    if (!hasDeployRoot(deployRoots, root)) {
      throw new Error(`${label} target missing ${root} deploy root`);
    }
  }
}

/** Resolve a host home directory from an env override, falling back under `homedir()`. */
export function resolveEnvHome(
  envVar: string,
  fallbackSegments: readonly string[],
  options: { env?: NodeJS.ProcessEnv; home?: string } = {},
): string {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const configured = env[envVar]?.trim();
  return resolve(configured || resolve(home, ...fallbackSegments));
}

/** Resolve `$XDG_CONFIG_HOME` (absolute by default) or `~/.config`. */
export function resolveXdgConfigHome(
  options: {
    env?: NodeJS.ProcessEnv;
    home?: string;
    /** Accept and resolve a relative value (OpenCode legacy behavior). */
    allowRelative?: boolean;
  } = {},
): string {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const configured = env.XDG_CONFIG_HOME?.trim();
  if (configured && options.allowRelative !== true && !isAbsolute(configured)) {
    throw new Error("XDG_CONFIG_HOME must be an absolute path");
  }
  return configured ? resolve(configured) : resolve(home, ".config");
}

/** True when any listed directory or file exists under `cwd`. */
export function detectAnyPath(
  cwd: string,
  spec: { dirs?: readonly string[]; files?: readonly string[] },
): boolean {
  for (const rel of spec.dirs ?? []) {
    const path = resolve(cwd, rel);
    if (existsSync(path) && statSync(path).isDirectory()) return true;
  }
  for (const rel of spec.files ?? []) {
    const path = resolve(cwd, rel);
    if (existsSync(path) && statSync(path).isFile()) return true;
  }
  return false;
}
