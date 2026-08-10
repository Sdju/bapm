/**
 * Shared helpers for OpenAPM lk-015 tree_sha256 integration tests.
 * Fixture planting only — product algorithm is asserted via @b-apm/core public API.
 */
import * as core from "@b-apm/core";
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  depsOf,
  diagnosticsText,
  ensureDir,
  exitCodeOf,
  expectRejectsMatching,
  fakeCommit,
  getRunAuditCi,
  listFilesRecursive,
  lockOf,
  modulesDir,
  readLockBytes,
  sha256Hex,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "../lifecycle/helpers.ts";
import { getRunInstall } from "../install/helpers.ts";

export {
  createFakePorts,
  createTempProject,
  depsOf,
  diagnosticsText,
  ensureDir,
  exitCodeOf,
  expectRejectsMatching,
  fakeCommit,
  getRunAuditCi,
  getRunInstall,
  listFilesRecursive,
  lockOf,
  modulesDir,
  readLockBytes,
  sha256Hex,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
};

type AnyFn = (...args: never[]) => unknown;

function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @b-apm/core to export one of [${names.join(", ")}] (${label})`);
}

/** Public OpenAPM §5.6.4 tree hash. */
export function getComputeCanonicalTreeSha256(): (rootDir: string) => string {
  return pickExport(
    ["computeCanonicalTreeSha256", "canonicalTreeSha256", "hashCanonicalTree"],
    "lk-015 tree_sha256",
  ) as (rootDir: string) => string;
}

/**
 * Test-local §5.6.4 mirror for planting lock fixtures (`.git` excluded).
 * Not a substitute for the public API assertion.
 */
export function referenceCanonicalTreeSha256(rootDir: string): string {
  return `sha256:${hashTree(rootDir)}`;
}

function hashTree(dir: string): string {
  const names = readdirSync(dir).filter((n) => n !== ".git");
  names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const chunks: Buffer[] = [];
  for (const name of names) {
    const abs = join(dir, name);
    const st = lstatSync(abs);
    let mode: string;
    let blobHex: string;
    if (st.isSymbolicLink()) {
      mode = "120000";
      blobHex = sha256Bytes(Buffer.from(readlinkSync(abs), "utf8"));
    } else if (st.isDirectory()) {
      mode = "040000";
      blobHex = hashTree(abs);
    } else if (st.isFile()) {
      mode = (st.mode & 0o111) !== 0 ? "100755" : "100644";
      blobHex = sha256Bytes(readFileSync(abs));
    } else {
      throw new Error(`unsupported entry for reference tree hash: ${abs}`);
    }
    chunks.push(Buffer.from(`${mode} ${name} ${blobHex}\n`, "utf8"));
  }
  return sha256Bytes(Buffer.concat(chunks));
}

function sha256Bytes(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Locate a materialized package tree under apm_modules after fake download. */
export function findPackageTreeRoot(cwd: string, hint?: string): string {
  const root = modulesDir(cwd);
  const files = listFilesRecursive(root);
  if (files.length === 0) {
    throw new Error(`expected package files under ${root}`);
  }
  const apmYmls = files.filter((f) => /(^|[/\\])(apm|bapm)\.yml$/.test(f));
  for (const rel of apmYmls) {
    const abs = join(root, rel);
    if (hint) {
      try {
        const text = readFileSync(abs, "utf8");
        if (!text.includes(hint)) continue;
      } catch {
        continue;
      }
    }
    return join(abs, "..");
  }
  const first = files[0]!;
  const parts = first.split(/[/\\]/);
  if (parts.length >= 2) {
    return join(root, ...parts.slice(0, -1));
  }
  return root;
}
