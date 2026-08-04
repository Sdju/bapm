/**
 * Deployed harness inventory helpers for Install (lk-017 lite).
 * Hash algorithm: SHA-256 of file bytes, lowercase hex (no algorithm prefix).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { MaterializeReport } from "bapm-target-api";
import type { LockedDependency, LockfileDocument } from "@/modules/Lockfile";
import type { AttributedPrimitive } from "@/modules/Primitives";
import { InstallError } from "./errors.ts";

/** Documented stable hash for deployed_file_hashes. */
export const DEPLOYED_HASH_ALGO = "sha256" as const;

export function hashFileBytes(content: Buffer | string): string {
  return createHash(DEPLOYED_HASH_ALGO).update(content).digest("hex");
}

export function hashFileAt(absPath: string): string {
  return hashFileBytes(readFileSync(absPath));
}

function toPosix(rel: string): string {
  return rel.split(sep).join("/");
}

/** Ensure relative path stays inside cwd (no escape). */
export function safeResolveUnderCwd(cwd: string, relPath: string): string | undefined {
  const cleaned = relPath.replace(/^[/\\]+/, "");
  if (!cleaned || cleaned.includes("..")) return undefined;
  const abs = resolve(cwd, cleaned);
  const root = resolve(cwd);
  const rel = abs.startsWith(root + sep) || abs === root;
  return rel ? abs : undefined;
}

/**
 * Remove harness files recorded in previous lock for deps no longer in the resolve set.
 * No-op when inventory is absent. Never deletes paths outside recorded inventory.
 */
export function cleanupOrphanDeployedFiles(args: {
  cwd: string;
  previous: LockfileDocument | null | undefined;
  currentDepNames: Set<string>;
}): string[] {
  const removed: string[] = [];
  const deps = args.previous?.dependencies;
  if (!Array.isArray(deps)) return removed;

  for (const dep of deps) {
    const name = String(dep.name ?? "");
    if (!name || args.currentDepNames.has(name)) continue;
    const hashes = dep.deployed_file_hashes;
    if (!hashes || typeof hashes !== "object") continue;
    for (const relPath of Object.keys(hashes)) {
      const abs = safeResolveUnderCwd(args.cwd, relPath);
      if (!abs || !existsSync(abs)) continue;
      try {
        unlinkSync(abs);
        removed.push(toPosix(relPath));
        // Best-effort empty parent cleanup is intentionally skipped (fail-safe).
      } catch {
        /* ignore unlink errors; fail-open for leftover files */
      }
    }
  }
  return removed;
}

export type DeployedHashViolation = {
  path: string;
  kind: "missing" | "mismatch";
  expected?: string;
  actual?: string;
  message: string;
};

function collectHashChecks(document: LockfileDocument): Array<{ path: string; expected: string }> {
  const checks: Array<{ path: string; expected: string }> = [];

  for (const dep of document.dependencies ?? []) {
    const hashes = dep.deployed_file_hashes;
    if (!hashes || typeof hashes !== "object") continue;
    for (const [path, expected] of Object.entries(hashes)) {
      if (typeof expected === "string") checks.push({ path, expected });
    }
  }

  const local = document.local_deployed_file_hashes;
  if (local && typeof local === "object") {
    for (const [path, expected] of Object.entries(local)) {
      if (typeof expected === "string") checks.push({ path, expected });
    }
  }
  return checks;
}

function normalizeHashValue(value: string): string {
  // Accept both raw hex and `sha256:<hex>` / `sha-256:<hex>` wire forms
  const m = value.trim().match(/^(?:sha-?256:)?([0-9a-fA-F]{64})$/i);
  return m ? m[1]!.toLowerCase() : value.trim().toLowerCase();
}

/**
 * Collect deployed hash / presence violations without throwing (for audit --ci).
 * No-op (empty) when no inventory present. tree_sha256 is handled separately via
 * `collectTreeSha256Violations` (lk-015).
 */
export function collectDeployedHashViolations(args: {
  cwd: string;
  document: LockfileDocument;
}): DeployedHashViolation[] {
  const violations: DeployedHashViolation[] = [];
  for (const { path, expected } of collectHashChecks(args.document)) {
    const abs = safeResolveUnderCwd(args.cwd, path);
    const expectedNorm = normalizeHashValue(expected);
    if (!abs || !existsSync(abs)) {
      violations.push({
        path,
        kind: "missing",
        expected: expectedNorm,
        message: `Missing deployed file (absent on disk): ${path}; expected hash ${expectedNorm}`,
      });
      continue;
    }
    const actual = hashFileAt(abs);
    if (actual !== expectedNorm) {
      violations.push({
        path,
        kind: "mismatch",
        expected: expectedNorm,
        actual,
        message: `Hash mismatch for ${path}: expected ${expectedNorm}, observed ${actual}`,
      });
    }
  }
  return violations;
}

/**
 * Re-verify on-disk content against lock deployed_file_hashes (lk-017 lite).
 * No-op when no inventory present.
 */
export function verifyDeployedFileHashes(args: { cwd: string; document: LockfileDocument }): void {
  const violations = collectDeployedHashViolations(args);
  if (violations.length === 0) return;
  const first = violations[0]!;
  throw new InstallError(
    "INSTALL_FROZEN_HASH_MISMATCH",
    first.kind === "missing"
      ? `Frozen deployed file integrity failed: missing harness path ${first.path}`
      : `Frozen deployed file hash mismatch (integrity): ${first.path}`,
    {
      details: {
        path: first.path,
        expected: first.expected,
        actual: first.actual,
        kind: first.kind,
      },
    },
  );
}

export type ResolvedDeployedFile = { path: string; hash: string };

/** Normalize materialize return / void into path+hash list (core hashes when omitted). */
export function collectDeployedHashes(
  cwd: string,
  report: void | MaterializeReport | null | undefined,
): ResolvedDeployedFile[] {
  if (!report || typeof report !== "object") return [];
  const files = report.deployedFiles;
  if (!Array.isArray(files)) return [];

  const out: ResolvedDeployedFile[] = [];
  for (const f of files) {
    if (!f || typeof f !== "object") continue;
    const path = typeof f.path === "string" ? toPosix(f.path) : "";
    if (!path) continue;
    if (typeof f.hash === "string" && f.hash.length > 0) {
      out.push({ path, hash: f.hash });
      continue;
    }
    const abs = safeResolveUnderCwd(cwd, path);
    if (!abs || !existsSync(abs)) continue;
    out.push({ path, hash: hashFileAt(abs) });
  }
  return out;
}

function packageNameOf(p: AttributedPrimitive): string | undefined {
  if (p.packageName) return p.packageName;
  if (typeof p.source === "string" && p.source.startsWith("dependency:")) {
    return p.source.slice("dependency:".length);
  }
  return undefined;
}

function primitiveNameFromDeployPath(relPath: string): string | undefined {
  const posix = toPosix(relPath);
  // .agents/skills/<name>/SKILL.md
  let m = posix.match(/\.agents\/skills\/([^/]+)\//);
  if (m) return m[1];
  // .cursor/rules/<name>.mdc
  m = posix.match(/\.cursor\/rules\/([^/]+)\.mdc$/);
  if (m) return m[1];
  // .cursor/agents/<name>.md
  m = posix.match(/\.cursor\/agents\/([^/]+)\.md$/);
  if (m) return m[1];
  return undefined;
}

/**
 * Attach deployed_file_hashes onto lock dependency entries (by contributing package).
 * Unattributed paths go to document-level local_deployed_file_hashes.
 * Returns whether any hashes were written.
 */
export function applyDeployedHashesToLock(args: {
  document: LockfileDocument;
  deployed: ResolvedDeployedFile[];
  primitives: AttributedPrimitive[];
}): boolean {
  if (args.deployed.length === 0) return false;

  const byName = new Map<string, AttributedPrimitive>();
  for (const p of args.primitives) {
    byName.set(String(p.name), p);
  }

  let wrote = false;
  for (const { path, hash } of args.deployed) {
    const primName = primitiveNameFromDeployPath(path);
    const prim = primName ? byName.get(primName) : undefined;
    const pkg = prim ? packageNameOf(prim) : undefined;
    const deps = args.document.dependencies ?? [];
    const dep: LockedDependency | undefined = pkg
      ? deps.find((d) => String(d.name ?? "") === pkg)
      : undefined;

    if (dep) {
      dep.deployed_file_hashes = { ...dep.deployed_file_hashes, [path]: hash };
      wrote = true;
      continue;
    }

    // Fallback: single-dep projects or unattributed — prefer sole dependency, else local_*
    if (deps.length === 1) {
      const only = deps[0]!;
      only.deployed_file_hashes = { ...only.deployed_file_hashes, [path]: hash };
      wrote = true;
      continue;
    }

    args.document.local_deployed_file_hashes = {
      ...args.document.local_deployed_file_hashes,
      [path]: hash,
    };
    wrote = true;
  }

  return wrote;
}
