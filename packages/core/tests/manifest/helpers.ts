import { mkdirSync, mkdtempSync, rmSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const fixturesDir = join(suiteDir, "fixtures");

/** Absolute path to a vendored fixture under `./fixtures/`. */
export function fixturePath(name: string): string {
  return join(fixturesDir, name);
}

export type TempProject = {
  cwd: string;
  cleanup: () => void;
};

/** Isolated project root for discovery / load tests. */
export function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-m1-accept-"));
  return {
    cwd,
    cleanup: () => {
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}

export function writeManifest(
  cwd: string,
  filename: "apm.yml" | "bapm.yml",
  contents: string,
): string {
  const path = join(cwd, filename);
  writeFileSync(path, contents, "utf8");
  return path;
}

export function copyFixtureAs(
  cwd: string,
  fixtureName: string,
  filename: "apm.yml" | "bapm.yml",
): string {
  const dest = join(cwd, filename);
  cpSync(fixturePath(fixtureName), dest);
  return dest;
}

/** Prefer live `.samples/apm/apm.yml`; fall back to vendored CI copy. */
export function resolveRealApmYml(): { path: string; source: "samples" | "vendored" } {
  const samples = join(suiteDir, "../../../../.samples/apm/apm.yml");
  if (existsSync(samples)) {
    return { path: samples, source: "samples" };
  }
  return { path: fixturePath("real-apm-root.yml"), source: "vendored" };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/** Pull document fields from loadManifest result regardless of bag shape. */
export function documentOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected loadManifest result object");
  }
  const r = result as Record<string, unknown>;
  const doc = (r.document ?? r.manifest ?? r) as Record<string, unknown>;
  if (doc === null || typeof doc !== "object") {
    throw new TypeError("expected document/manifest object on load result");
  }
  return doc;
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
