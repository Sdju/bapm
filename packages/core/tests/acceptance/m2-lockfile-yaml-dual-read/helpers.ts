import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  cpSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const acceptanceDir = dirname(fileURLToPath(import.meta.url));
export const fixturesDir = join(acceptanceDir, "fixtures");

/** Absolute path to a vendored fixture under `./fixtures/`. */
export function fixturePath(name: string): string {
  return join(fixturesDir, name);
}

export function readFixture(name: string): string {
  return readFileSync(fixturePath(name), "utf8");
}

export type TempProject = {
  cwd: string;
  cleanup: () => void;
};

/** Isolated project root for discovery / load / write tests. */
export function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-m2-accept-"));
  return {
    cwd,
    cleanup: () => {
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}

export type LockFilename = "apm.lock.yaml" | "bapm.lock.yaml";

export function writeLock(cwd: string, filename: LockFilename, contents: string): string {
  const path = join(cwd, filename);
  writeFileSync(path, contents, "utf8");
  return path;
}

export function copyFixtureAs(cwd: string, fixtureName: string, filename: LockFilename): string {
  const dest = join(cwd, filename);
  cpSync(fixturePath(fixtureName), dest);
  return dest;
}

/**
 * Prefer live `.samples/apm/apm.lock.yaml`; fall back to vendored CI copy.
 */
export function resolveRealApmLock(): {
  path: string;
  source: "samples" | "vendored";
} {
  const samples = join(acceptanceDir, "../../../../../.samples/apm/apm.lock.yaml");
  if (existsSync(samples)) {
    return { path: samples, source: "samples" };
  }
  return { path: fixturePath("real-apm-root.lock.yaml"), source: "vendored" };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/**
 * Pull lockfile document fields from load/parse result regardless of bag shape.
 */
export function lockOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected lockfile result object");
  }
  const r = result as Record<string, unknown>;
  const doc = (r.document ?? r.lockfile ?? r.lock ?? r) as Record<string, unknown>;
  if (doc === null || typeof doc !== "object") {
    throw new TypeError("expected document/lockfile object on load result");
  }
  return doc;
}

export function depsOf(doc: Record<string, unknown>): Record<string, unknown>[] {
  const deps = doc.dependencies;
  if (!Array.isArray(deps)) {
    throw new TypeError("expected dependencies array");
  }
  return deps as Record<string, unknown>[];
}

export function expectThrowsMatching(fn: () => unknown, pattern: RegExp): unknown {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  if (thrown === undefined) {
    throw new Error(`expected throw matching ${pattern}`);
  }
  // Surface missing public API clearly during TDD RED (do not mask as pattern miss).
  if (thrown instanceof TypeError && /is not a function/i.test(thrown.message)) {
    throw thrown;
  }
  const message =
    thrown instanceof Error
      ? thrown.message
      : typeof thrown === "object" && thrown !== null && "message" in thrown
        ? String((thrown as { message: unknown }).message)
        : String(thrown);
  const code =
    typeof thrown === "object" && thrown !== null && "code" in thrown
      ? String((thrown as { code: unknown }).code)
      : "";
  const haystack = `${message}\n${code}`;
  if (!pattern.test(haystack)) {
    throw new Error(`expected error matching ${pattern}, got: ${haystack}`);
  }
  return thrown;
}
