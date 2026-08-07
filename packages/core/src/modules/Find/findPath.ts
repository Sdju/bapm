import { resolve } from "node:path";
import {
  BAPM_LOCK_FILE,
  loadLockfileOrNull,
  type LockedDependency,
  type LockfileDocument,
} from "@/modules/Lockfile";
import { whyDeps } from "@/modules/Deps";
import { buildReverseIndex, packageOwnerKey } from "./buildReverseIndex.ts";
import { formatFindOrigin, formatFindOwnerLabel } from "./format.ts";
import { lookupInIndex, normalizeFindPath } from "./lookup.ts";
import { WORKSPACE_OWNER_KEY, type FindPathOptions, type FindPathResult } from "./types.ts";

/**
 * Offline find orchestration: load lock → reverse index → lookup → format.
 * Exits: 0 tracked, 1 unknown path, 2 missing/unreadable lock.
 */
export function findPath(options: FindPathOptions = {}): FindPathResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const queryRaw = String(options.path ?? options.query ?? "").trim();
  const showSource = options.source === true || options.showSource === true;
  const showPath = options.why === true || options.showPath === true || options.pathDetail === true;

  let loaded;
  try {
    loaded = loadLockfileOrNull({ cwd });
  } catch {
    return lockError();
  }
  if (!loaded) {
    return lockError();
  }

  const document = loaded.document;
  const index = buildReverseIndex(document);
  const normalized = normalizeFindPath(queryRaw);
  const owners = lookupInIndex(normalized, index);

  if (owners.length === 0) {
    const msg = `'${queryRaw || normalized}' is not tracked by any installed package in ${BAPM_LOCK_FILE}.`;
    return {
      ok: false,
      exitCode: 1,
      text: "",
      stderr: msg,
      owners: [],
    };
  }

  const depByKey = indexDeps(document);
  const lines: string[] = [];

  for (const owner of owners) {
    if (owner === WORKSPACE_OWNER_KEY) {
      if (showSource) {
        lines.push(formatFindOrigin(WORKSPACE_OWNER_KEY));
      } else {
        lines.push(WORKSPACE_OWNER_KEY);
      }
      continue;
    }

    const dep = depByKey.get(owner);
    const label = formatFindOwnerLabel(owner, dep ?? null);

    if (showPath) {
      lines.push(label);
      const whyText = renderWhy(cwd, owner, dep);
      if (whyText) {
        for (const line of whyText.split("\n")) {
          if (line.length > 0) lines.push(`  ${line}`);
        }
      }
      continue;
    }

    if (showSource && dep) {
      const origin = formatFindOrigin(owner, dep);
      lines.push(`${label}  ${origin}`);
      continue;
    }

    lines.push(label);
  }

  return {
    ok: true,
    exitCode: 0,
    text: lines.join("\n"),
    stderr: "",
    owners,
  };
}

export const runFind = findPath;
export const findDeployedPath = findPath;
export const runFindPath = findPath;

function lockError(): FindPathResult {
  const stderr = `No lockfile found at ${BAPM_LOCK_FILE}. Run 'bapm install' first.`;
  return {
    ok: false,
    exitCode: 2,
    text: "",
    stderr,
  };
}

function indexDeps(document: LockfileDocument): Map<string, LockedDependency> {
  const map = new Map<string, LockedDependency>();
  for (const dep of document.dependencies ?? []) {
    const key = packageOwnerKey(dep);
    if (key) map.set(key, dep);
    const repo = dep.repo_url != null ? String(dep.repo_url).trim() : "";
    if (repo) map.set(repo, dep);
    const name = dep.name != null ? String(dep.name).trim() : "";
    if (name) map.set(name, dep);
  }
  return map;
}

/**
 * Offline why chains via Deps walker. Empty why → null (caller prints label only).
 * Root labels use walker's existing text (`→`); never hard-code foreign `apm.yml`.
 */
function renderWhy(cwd: string, owner: string, dep: LockedDependency | undefined): string | null {
  const queries: string[] = [];
  if (dep?.repo_url) queries.push(String(dep.repo_url));
  if (dep?.name) queries.push(String(dep.name));
  if (!queries.includes(owner)) queries.push(owner);

  for (const q of queries) {
    const result = whyDeps({ cwd, package: q, name: q });
    if (!result.ok) continue;
    const text = String(result.text ?? "").trim();
    if (!text) continue;
    // Prefer chain text; skip "No dependency chains…" fallback noise
    if (/^No dependency chains found/i.test(text)) return null;
    return text;
  }
  return null;
}
