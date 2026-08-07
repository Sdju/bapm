import { resolve } from "node:path";
import { resolvePackageQuery } from "@/modules/Deps";
import {
  loadLockfileOrNull,
  locateGitPackageTree,
  type LockedDependency,
} from "@/modules/Lockfile";
import { loadManifest } from "@/modules/Manifest";
import type { ViewPackageOptions, ViewPackageResult } from "./types.ts";

/**
 * Offline local package view: lock resolve → modules path → optional summary.
 * Honest exits: 0 success, 1 not_installed/ambiguous, 2 no_lockfile.
 * No network / registry I/O.
 */
export function viewPackage(options: ViewPackageOptions = {}): ViewPackageResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const query = String(options.package ?? options.name ?? options.query ?? "").trim();

  let loaded;
  try {
    loaded = loadLockfileOrNull({ cwd });
  } catch {
    return failNoLockfile(query);
  }
  if (!loaded) {
    return failNoLockfile(query);
  }

  const deps = loaded.document.dependencies ?? [];
  const matches = resolvePackageQuery(deps, query);

  if (matches.length === 0) {
    return {
      ok: false,
      exitCode: 1,
      error: "not_installed",
      query,
      text: `Package not installed: ${query || "(missing package)"}`,
    };
  }

  if (matches.length > 1) {
    const matchIds = matches.map((m) => ({
      ...(m.name ? { name: String(m.name) } : {}),
      ...(m.repo_url ? { repo_url: String(m.repo_url) } : {}),
    }));
    return {
      ok: false,
      exitCode: 1,
      error: "ambiguous",
      query,
      matches: matchIds,
      text: `Ambiguous package query ${query}: ${matchIds
        .map((m) => m.name ?? m.repo_url ?? "?")
        .join(", ")}`,
    };
  }

  const target = matches[0]!;
  const identity = {
    ...(target.name != null && String(target.name).length > 0 ? { name: String(target.name) } : {}),
    ...(target.repo_url != null && String(target.repo_url).length > 0
      ? { repo_url: String(target.repo_url) }
      : {}),
  };
  const pin = pinOf(target);
  const modulesPath = locateGitPackageTree(cwd, target);
  const summary = modulesPath ? readPackageSummary(modulesPath) : undefined;

  const lines: string[] = [];
  const label = identity.name ?? identity.repo_url ?? query;
  lines.push(`Package: ${label}`);
  if (identity.repo_url && identity.name) {
    lines.push(`Repo: ${identity.repo_url}`);
  }
  if (pin) {
    lines.push(`Version: ${pin}`);
  }
  if (modulesPath) {
    lines.push(`Path: ${modulesPath}`);
  } else {
    lines.push("Path: (modules path unavailable)");
  }
  if (summary) {
    lines.push(`Summary: ${summary}`);
  }

  return {
    ok: true,
    exitCode: 0,
    identity,
    version: pin,
    pin,
    ...(modulesPath ? { modulesPath } : {}),
    ...(summary ? { summary } : {}),
    text: lines.join("\n"),
  };
}

export const runView = viewPackage;
export const viewLocalPackage = viewPackage;
export const localView = viewPackage;

function failNoLockfile(query: string): ViewPackageResult {
  return {
    ok: false,
    exitCode: 2,
    error: "no_lockfile",
    query: query || undefined,
    text: "No lockfile found (missing or unreadable)",
  };
}

/** version → resolved_ref → resolved_tag → short resolved_commit */
function pinOf(d: LockedDependency): string {
  if (d.version != null && String(d.version).length > 0) return String(d.version);
  if (d.resolved_ref != null && String(d.resolved_ref).length > 0) {
    return String(d.resolved_ref);
  }
  if (d.resolved_tag != null && String(d.resolved_tag).length > 0) {
    return String(d.resolved_tag);
  }
  if (d.resolved_commit != null && String(d.resolved_commit).length > 0) {
    return String(d.resolved_commit).slice(0, 12);
  }
  return "";
}

function readPackageSummary(modulesPath: string): string | undefined {
  try {
    const { document } = loadManifest({ cwd: modulesPath });
    const summary =
      (typeof document.summary === "string" && document.summary.trim()) ||
      (typeof document.description === "string" && document.description.trim()) ||
      "";
    return summary || undefined;
  } catch {
    return undefined;
  }
}
