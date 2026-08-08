/**
 * Helpers for bapm.local.yml personal overlay tests
 * (promoted from manifest-local-overlay acceptance).
 */
import { asText } from "../asText.ts";
import * as core from "@bapm/core";
import {
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { unzipSync } from "fflate";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");
export const repoRoot = resolve(coreRoot, "../..");

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-local-overlay-"): TempProject {
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

export function writeBaseManifest(
  cwd: string,
  body: string,
  filename: "bapm.yml" | "apm.yml" = "bapm.yml",
): void {
  writeText(join(cwd, filename), body);
}

export function writeLocalOverlay(cwd: string, body: string): void {
  writeText(join(cwd, "bapm.local.yml"), body);
}

export function conformingBase(overrides?: {
  name?: string;
  version?: string;
  extraYaml?: string;
}): string {
  const name = overrides?.name ?? "overlay-demo";
  const version = overrides?.version ?? "0.1.0";
  const extra = overrides?.extraYaml ? `${overrides.extraYaml.trimEnd()}\n` : "";
  return `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n${extra}`;
}

type AnyFn = (...args: never[]) => unknown;

function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

/**
 * Effective load: prefer loadEffectiveManifest; fall back to loadManifest
 * (apply may extend either — both must return the merged document).
 */
export function getLoadEffectiveManifest(): (options: Record<string, unknown>) => unknown {
  const c = core as Record<string, unknown>;
  if (typeof c.loadEffectiveManifest === "function") {
    return c.loadEffectiveManifest as (options: Record<string, unknown>) => unknown;
  }
  return pickExport(["loadManifest"], "effective manifest load") as (
    options: Record<string, unknown>,
  ) => unknown;
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

export function getRunDoctor(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runDoctor", "doctor", "checkDoctor"], "doctor") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getRunInstall(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runInstall", "installProject"], "install") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function documentOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected document-like load result");
  }
  const r = result as Record<string, unknown>;
  const doc = (r.document ?? r.manifest ?? r) as Record<string, unknown>;
  if (doc === null || typeof doc !== "object") {
    throw new TypeError("expected document/manifest object");
  }
  return doc;
}

export function localPathOf(result: unknown): string | undefined {
  if (result === null || typeof result !== "object") return undefined;
  const r = result as Record<string, unknown>;
  for (const key of ["localPath", "overlayPath", "localOverlayPath"] as const) {
    if (typeof r[key] === "string") return r[key] as string;
  }
  return undefined;
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
  if (
    thrown instanceof TypeError &&
    /is not a function|expected @bapm\/core to export/i.test(thrown.message)
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
  for (const rel of ["publish.zip", "package.zip", "dist/publish.zip"]) {
    try {
      return new Uint8Array(readFileSync(join(cwd, rel)));
    } catch {
      /* continue */
    }
  }
  throw new TypeError("archive builder did not yield zip bytes or path");
}

export function exitCodeOf(result: unknown): number {
  if (typeof result === "number") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["exitCode", "code", "status", "ok"] as const) {
      if (key === "ok" && typeof r.ok === "boolean") return r.ok ? 0 : 1;
      if (typeof r[key] === "number") return r[key] as number;
    }
  }
  throw new TypeError("expected numeric exit code or { exitCode | code | status | ok }");
}

export function textOf(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["text", "output", "stdout", "message", "plan"] as const) {
      if (typeof r[key] === "string") return r[key] as string;
      if (Array.isArray(r[key])) return (r[key] as unknown[]).map(String).join("\n");
    }
    if (Array.isArray(r.checks)) {
      return (r.checks as Array<Record<string, unknown>>)
        .map((c) => `${c.ok ? "PASS" : "FAIL"}\t${asText(c.name)}\t${asText(c.message)}`)
        .join("\n");
    }
  }
  return asText(result ?? "");
}

export function doctorHaystack(result: unknown): string {
  return `${textOf(result)}\n${JSON.stringify(result)}`;
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

/** Init a real git repo in cwd and optionally track bapm.local.yml. */
export function initGitRepo(cwd: string, options?: { trackLocal?: boolean }): void {
  const run = (args: string[]) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout || r.status}`);
    }
  };
  run(["init"]);
  run(["config", "user.email", "overlay-test@example.com"]);
  run(["config", "user.name", "Overlay Test"]);
  run(["add", "bapm.yml"]);
  if (options?.trackLocal) {
    run(["add", "-f", "bapm.local.yml"]);
  }
  run(["commit", "-m", "init"]);
}

export { core };
