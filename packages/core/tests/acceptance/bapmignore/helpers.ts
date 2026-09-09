/**
 * Helpers for bapmignore acceptance (RED → GREEN).
 * Specs: pack-bapmignore, producer-pack-archive, producer-publish.
 */
import { asText } from "../../asText.ts";
import * as core from "@b-apm/core";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { unzipSync } from "fflate";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-bapmignore-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writeManifest(
  cwd: string,
  body: string,
  filename: "bapm.yml" | "apm.yml" = "bapm.yml",
): void {
  writeText(join(cwd, filename), body);
}

export function conformingManifest(name: string, version = "1.0.0"): string {
  return `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`;
}

/** owner/repo form required by publish archive builder. */
export function conformingPublishManifest(name: string, version = "1.0.0"): string {
  return conformingManifest(name.includes("/") ? name : `example/${name}`, version);
}

export function writeBapmIgnore(cwd: string, contents: string): void {
  writeText(join(cwd, ".bapmignore"), contents);
}

type AnyFn = (...args: never[]) => unknown;

function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @b-apm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getRunPack(): (options: Record<string, unknown>) => unknown {
  return pickExport(["runPack", "packProject", "packArchive"], "pack archive") as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function getBuildPublishArchive(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    [
      "buildPublishArchive",
      "createPublishArchive",
      "packPublishArchive",
      "buildRegistryPublishZip",
    ],
    "publish archive",
  ) as (options: Record<string, unknown>) => unknown;
}

/** Optional helper apply may export; used when present for dry-run membership asserts. */
export function tryGetCollectPackFiles():
  | ((cwd: string) => Array<{ relativePath: string }>)
  | undefined {
  const c = core as Record<string, unknown>;
  for (const name of ["collectPackFiles", "collectProjectPackFiles"]) {
    if (typeof c[name] === "function") {
      return c[name] as (cwd: string) => Array<{ relativePath: string }>;
    }
  }
  return undefined;
}

export function resolvePackArtifact(cwd: string, result?: unknown): string | undefined {
  if (result !== null && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["archivePath", "outputPath", "path", "artifactPath", "zipPath"] as const) {
      const v = r[key];
      if (typeof v === "string" && existsSync(v)) return v;
    }
  }
  if (existsSync(cwd)) {
    for (const name of readdirSync(cwd)) {
      if (name.endsWith(".zip")) {
        const p = join(cwd, name);
        if (statSync(p).isFile()) return p;
      }
    }
  }
  return undefined;
}

export function listZipPaths(bytes: Uint8Array): string[] {
  const entries = unzipSync(bytes);
  return Object.keys(entries).map((p) => p.replace(/\\/g, "/"));
}

export function resolveArchiveBytes(cwd: string, result: unknown): Uint8Array {
  if (result instanceof Uint8Array) return result;
  if (Buffer.isBuffer(result)) return new Uint8Array(result);
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.bytes instanceof Uint8Array) return r.bytes;
    if (Buffer.isBuffer(r.bytes)) return new Uint8Array(r.bytes);
    if (typeof r.archivePath === "string" || typeof r.path === "string") {
      return new Uint8Array(readFileSync(asText(r.archivePath ?? r.path)));
    }
  }
  const artifact = resolvePackArtifact(cwd, result);
  if (artifact) return new Uint8Array(readFileSync(artifact));
  throw new TypeError("expected zip bytes or archive path from pack/publish");
}

export function zipHas(paths: string[], name: string): boolean {
  const normalized = name.replace(/\\/g, "/");
  return paths.some(
    (p) =>
      p === normalized ||
      p.endsWith(`/${normalized}`) ||
      p === `./${normalized}` ||
      p.startsWith(`${normalized}/`),
  );
}

export function filesPackedOf(result: unknown): number | undefined {
  if (result === null || typeof result !== "object") return undefined;
  const n = (result as Record<string, unknown>).filesPacked;
  return typeof n === "number" ? n : undefined;
}

export async function expectRejectsMatching(fn: () => unknown, pattern: RegExp): Promise<unknown> {
  let thrown: unknown;
  try {
    await fn();
  } catch (e) {
    thrown = e;
  }
  if (thrown === undefined) {
    throw new Error(`expected reject matching ${pattern}`);
  }
  if (
    thrown instanceof TypeError &&
    /is not a function|expected @b-apm\/core to export/i.test(thrown.message)
  ) {
    throw thrown;
  }
  const message =
    thrown instanceof Error
      ? thrown.message
      : typeof thrown === "object" && thrown !== null && "message" in thrown
        ? asText((thrown as { message: unknown }).message)
        : asText(thrown);
  const code =
    typeof thrown === "object" && thrown !== null && "code" in thrown
      ? asText((thrown as { code: unknown }).code)
      : "";
  const haystack = `${message}\n${code}`;
  if (!pattern.test(haystack)) {
    throw new Error(`expected error matching ${pattern}, got: ${haystack}`);
  }
  return thrown;
}

/** Make root `.bapmignore` unreadable as a UTF-8 text pattern file (directory collision). */
export function plantUnreadableBapmIgnore(cwd: string): void {
  const path = join(cwd, ".bapmignore");
  mkdirSync(path, { recursive: true });
  writeText(join(path, "nested.txt"), "not-a-pattern-file\n");
}

/** Alternate unreadable: zero-permission file (best-effort; skipped if chmod ineffective). */
export function tryChmodUnreadable(path: string): boolean {
  try {
    chmodSync(path, 0);
    try {
      readFileSync(path);
      chmodSync(path, 0o644);
      return false;
    } catch {
      return true;
    }
  } catch {
    return false;
  }
}

export { core };
