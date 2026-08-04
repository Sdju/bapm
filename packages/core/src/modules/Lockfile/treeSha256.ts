/**
 * OpenAPM §5.6.4 / req-lk-015 canonical git-tree SHA-256.
 * Excludes `.git` from the walk (working-tree content only).
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { normalizeHashValue } from "./hash.ts";
import type { LockedDependency, LockfileDocument } from "./types.ts";

const SKIP_NAMES = new Set([".git"]);
/** Must match Resolver `APM_MODULES_DIR` (avoid Lockfile→Resolver import cycle). */
const MODULES_DIR = "apm_modules";

export type TreeSha256Violation = {
  entry: string;
  kind: "missing_field" | "missing_tree" | "mismatch";
  expected?: string;
  observed?: string;
  message: string;
};

/**
 * Compute OpenAPM canonical tree hash for a package root on disk.
 * Returns envelope `sha256:<lowercase-hex>`.
 */
export function computeCanonicalTreeSha256(rootDir: string): string {
  const digest = hashTree(rootDir);
  return `sha256:${digest}`;
}

function hashTree(dir: string): string {
  const names = readdirSync(dir).filter((n) => !SKIP_NAMES.has(n));
  names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const chunks: Buffer[] = [];
  for (const name of names) {
    const abs = join(dir, name);
    const st = lstatSync(abs);
    let mode: string;
    let blobHex: string;

    if (st.isSymbolicLink()) {
      mode = "120000";
      const target = readlinkSync(abs);
      blobHex = sha256Hex(Buffer.from(target, "utf8"));
    } else if (st.isDirectory()) {
      mode = "040000";
      blobHex = hashTree(abs);
    } else if (st.isFile()) {
      const executable = (st.mode & 0o111) !== 0;
      mode = executable ? "100755" : "100644";
      blobHex = sha256Hex(readFileSync(abs));
    } else {
      throw new Error(`Unsupported filesystem entry type for tree_sha256: ${abs}`);
    }

    // <mode-octal> SP <name-utf8> SP <blob-sha256-hex> LF
    chunks.push(Buffer.from(`${mode} ${name} ${blobHex}\n`, "utf8"));
  }

  return sha256Hex(Buffer.concat(chunks));
}

function sha256Hex(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Compare two hash envelopes / bare hex for equality. */
export function treeSha256Equal(a: string, b: string): boolean {
  const na = String(normalizeHashValue(a));
  const nb = String(normalizeHashValue(b));
  return na === nb;
}

/**
 * Format a violation message naming entry + expected/observed envelopes.
 */
export function formatTreeSha256Violation(
  v: Omit<TreeSha256Violation, "message"> & { message?: string },
): TreeSha256Violation {
  const label = v.entry;
  let message = v.message;
  if (!message) {
    if (v.kind === "missing_field") {
      message = `Missing tree_sha256 for git entry ${label}`;
    } else if (v.kind === "missing_tree") {
      message = `Missing on-disk package tree for git entry ${label} (cannot re-verify tree_sha256)`;
    } else {
      message = `tree_sha256 mismatch for ${label}: expected ${v.expected ?? "?"}, observed ${v.observed ?? "?"}`;
    }
  }
  return { ...v, message };
}

/** Git-sourced lock entry (not local-path / registry). */
export function isGitSourcedLockEntry(dep: LockedDependency): boolean {
  const source = dep.source;
  if (source === "local" || source === "registry") return false;
  const repo = String(dep.repo_url ?? "");
  if (!repo || repo.startsWith("local:")) return false;
  // Registry materialization without git commit
  if (
    typeof dep.resolved_url === "string" &&
    typeof dep.resolved_hash === "string" &&
    !dep.resolved_commit
  ) {
    return false;
  }
  // Git lock identities are host/path (contain '/'); bare names are local-ish pins
  if (!repo.includes("/")) return false;
  return true;
}

function entryLabel(dep: LockedDependency): string {
  const name = typeof dep.name === "string" ? dep.name : "";
  const repo = String(dep.repo_url ?? "");
  if (name && repo) return `${name} (${repo})`;
  return name || repo || "unknown";
}

function lockRepoIdentity(repoUrl: string): string {
  const trimmed = repoUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const path = u.pathname
        .replace(/^\//, "")
        .replace(/\.git$/i, "")
        .replace(/\/+$/, "");
      return `${u.hostname.toLowerCase()}/${path}`;
    } catch {
      /* fallthrough */
    }
  }
  return trimmed.replace(/\.git$/i, "").replace(/\/+$/, "");
}

function identityToCacheDir(identity: string): string {
  return identity.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

/**
 * Locate materialized git package tree under `apm_modules` for a lock entry.
 */
export function locateGitPackageTree(cwd: string, dep: LockedDependency): string | undefined {
  const repo = String(dep.repo_url ?? "");
  if (!repo) return undefined;
  const identity = lockRepoIdentity(repo);
  const base = join(cwd, MODULES_DIR, identityToCacheDir(identity));
  const commit = typeof dep.resolved_commit === "string" ? dep.resolved_commit : undefined;

  const candidates: string[] = [];
  if (commit) candidates.push(join(base, commit.slice(0, 12)));
  candidates.push(base);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const pathFrag =
      typeof dep.path === "string"
        ? dep.path
        : typeof dep.virtual_path === "string"
          ? dep.virtual_path
          : undefined;
    if (pathFrag) {
      const sub = join(candidate, pathFrag);
      if (existsSync(sub)) return sub;
    }
    return candidate;
  }
  return undefined;
}

/**
 * Collect tree_sha256 violations for git-sourced lock entries (audit / frozen).
 * Fail-closed: missing field, missing on-disk tree, or hash mismatch.
 */
export function collectTreeSha256Violations(args: {
  cwd: string;
  document: LockfileDocument;
}): TreeSha256Violation[] {
  const violations: TreeSha256Violation[] = [];
  for (const dep of args.document.dependencies ?? []) {
    if (!isGitSourcedLockEntry(dep)) continue;
    const label = entryLabel(dep);
    const recorded = dep.tree_sha256;
    if (typeof recorded !== "string" || recorded.trim() === "") {
      violations.push(
        formatTreeSha256Violation({
          entry: label,
          kind: "missing_field",
        }),
      );
      continue;
    }

    const treeRoot = locateGitPackageTree(args.cwd, dep);
    if (!treeRoot) {
      violations.push(
        formatTreeSha256Violation({
          entry: label,
          kind: "missing_tree",
          expected: recorded,
        }),
      );
      continue;
    }

    let observed: string;
    try {
      observed = computeCanonicalTreeSha256(treeRoot);
    } catch {
      violations.push(
        formatTreeSha256Violation({
          entry: label,
          kind: "missing_tree",
          expected: recorded,
          message: `Cannot re-verify tree_sha256 for git entry ${label}: package tree unreadable`,
        }),
      );
      continue;
    }

    if (!treeSha256Equal(recorded, observed)) {
      violations.push(
        formatTreeSha256Violation({
          entry: label,
          kind: "mismatch",
          expected: String(normalizeHashValue(recorded)),
          observed,
        }),
      );
    }
  }
  return violations;
}
