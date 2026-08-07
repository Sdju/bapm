/**
 * Acceptance helpers for local-path-source (bapm-only `local` source).
 * Behavioural contract only — no production source inspection.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  classifyDependencyRef,
  loadLockfile,
  parseManifestDocument,
  resolveAndLock,
  resolveDependencyGraph,
  type ResolverError,
} from "@bapm/core";

export type TempProject = {
  cwd: string;
  cleanup: () => void;
};

export function createTempProject(prefix = "bapm-local-src-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function writeText(path: string, contents: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, contents, "utf8");
}

export function writeRootManifest(cwd: string, apmEntriesYaml: string): void {
  writeText(
    join(cwd, "apm.yml"),
    `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n${apmEntriesYaml}`,
  );
}

export function writePackageAt(cwd: string, relDir: string, name: string): string {
  const pkgDir = join(cwd, relDir);
  writeText(
    join(pkgDir, "apm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
  return pkgDir;
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function gitignoreOf(cwd: string): string | null {
  const path = join(cwd, ".gitignore");
  return existsSync(path) ? readText(path) : null;
}

export function initGitRepo(cwd: string): void {
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.name", "bapm-test"], {
    cwd,
    stdio: "ignore",
  });
}

export function gitAddAllAndCommit(cwd: string, message = "init"): void {
  execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message, "--allow-empty"], {
    cwd,
    stdio: "ignore",
  });
}

export function parseApmObject(dep: Record<string, unknown>): Record<string, unknown> {
  const { document } = parseManifestDocument({
    name: "parse-root",
    version: "0.0.1",
    dependencies: { apm: [dep] },
  });
  const entry = document.dependencies?.apm?.[0];
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("expected object dependency after parse");
  }
  return entry as Record<string, unknown>;
}

export function expectParseReject(dep: Record<string, unknown>): string {
  try {
    parseManifestDocument({
      name: "parse-root",
      version: "0.0.1",
      dependencies: { apm: [dep] },
    });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error(`expected parse to reject ${JSON.stringify(dep)}`);
}

export async function captureResolverError(
  fn: () => Promise<unknown>,
): Promise<ResolverError> {
  try {
    await fn();
  } catch (error) {
    return error as ResolverError;
  }
  throw new Error("Expected resolution to reject");
}

export {
  classifyDependencyRef,
  loadLockfile,
  parseManifestDocument,
  resolveAndLock,
  resolveDependencyGraph,
};
