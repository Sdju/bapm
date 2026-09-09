/**
 * Helpers for separate-local-lockfile acceptance (RED → GREEN).
 */
import { asText } from "../../asText.ts";
import * as core from "@b-apm/core";
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
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { unzipSync } from "fflate";

export const PERSONAL_LOCK_FILE = "bapm.local.lock.yaml";
export const UNSUPPORTED_APM_PERSONAL_LOCK = "apm.local.lock.yaml";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-sep-local-lock-"): TempProject {
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

export function writePackageAt(cwd: string, relDir: string, name: string): void {
  writeText(
    join(cwd, relDir, "apm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
}

export function writeRootWithApmDeps(cwd: string, apmEntriesYaml: string, name = "root"): void {
  writeManifest(cwd, `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n${apmEntriesYaml}`);
}

export function minimalLockYaml(depsYaml = ""): string {
  const deps = depsYaml.trim()
    ? `\ndependencies:\n${depsYaml.trimEnd()}\n`
    : "\ndependencies: []\n";
  return `lockfile_version: "1"${deps}`;
}

export function personalLockPath(cwd: string): string {
  return join(cwd, PERSONAL_LOCK_FILE);
}

export function sharedLockPath(cwd: string): string | null {
  for (const name of ["bapm.lock.yaml", "apm.lock.yaml"] as const) {
    const p = join(cwd, name);
    if (existsSync(p)) return p;
  }
  return null;
}

export function readSharedLockYaml(cwd: string): string {
  const p = sharedLockPath(cwd);
  if (!p) throw new Error(`no shared lock in ${cwd}`);
  return readFileSync(p, "utf8");
}

export function readPersonalLockYaml(cwd: string): string {
  return readFileSync(personalLockPath(cwd), "utf8");
}

export function personalLockExists(cwd: string): boolean {
  return existsSync(personalLockPath(cwd));
}

export function sharedLockExists(cwd: string): boolean {
  return sharedLockPath(cwd) !== null;
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

/** Effective (shared ∪ personal) lock load — new API under apply. */
export function getLoadEffectiveLockfile(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["loadEffectiveLockfile", "loadMergedLockfile", "mergeLoadLockfile", "loadLockfileMerged"],
    "effective lock merge-load",
  ) as (options: Record<string, unknown>) => unknown;
}

export function getMergeLockDocuments(): (
  shared: unknown,
  personal: unknown,
  ...rest: unknown[]
) => unknown {
  return pickExport(
    ["mergeLockDocuments", "mergeLockfiles", "mergeLockfileDocuments"],
    "merge lock documents",
  ) as (shared: unknown, personal: unknown, ...rest: unknown[]) => unknown;
}

export function getLoadPersonalLockfileOrNull(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["loadPersonalLockfileOrNull", "loadLocalLockfileOrNull", "discoverPersonalLockfile"],
    "personal lock load",
  ) as (options: Record<string, unknown>) => unknown;
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

export function depNames(doc: Record<string, unknown>): string[] {
  return depsOf(doc)
    .map((d) => asText(d.name ?? d.repo_url ?? ""))
    .filter(Boolean);
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

export function initGitRepo(
  cwd: string,
  options?: { trackPersonalLock?: boolean; extraAdd?: string[] },
): void {
  const run = (args: string[]) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout || r.status}`);
    }
  };
  run(["init"]);
  run(["config", "user.email", "sep-local-lock@example.com"]);
  run(["config", "user.name", "Sep Local Lock"]);
  const toAdd = ["bapm.yml", ...(options?.extraAdd ?? [])];
  for (const f of toAdd) {
    if (existsSync(join(cwd, f))) run(["add", f]);
  }
  if (options?.trackPersonalLock && existsSync(personalLockPath(cwd))) {
    run(["add", "-f", PERSONAL_LOCK_FILE]);
  }
  run(["commit", "-m", "init", "--allow-empty"]);
}

export function gitignoreOf(cwd: string): string | null {
  const path = join(cwd, ".gitignore");
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function createFakePorts(options?: {
  commitsByRef?: Record<string, string>;
  failUrls?: string[];
}) {
  const commitsByRef = options?.commitsByRef ?? {};
  const failUrls = new Set(options?.failUrls ?? []);

  const tagLister = {
    async listTags(): Promise<Array<{ tag: string; commit: string }>> {
      return [];
    },
  };

  const gitRemote = {
    async resolveRef(repoUrl: string, ref: string): Promise<string> {
      if (failUrls.has(repoUrl) || [...failUrls].some((u) => repoUrl.includes(u))) {
        throw new Error(`git remote failed: ${repoUrl}`);
      }
      const key = `${repoUrl}#${ref}`;
      if (commitsByRef[key]) return commitsByRef[key];
      if (commitsByRef[ref]) return commitsByRef[ref];
      if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
      return "cccccccccccccccccccccccccccccccccccccccc";
    },
  };

  const downloader = {
    async download(args: {
      repoUrl?: string;
      path?: string;
      commit?: string;
      dest: string;
      identity?: string;
    }): Promise<void> {
      if (
        args.repoUrl &&
        (failUrls.has(args.repoUrl) || [...failUrls].some((u) => args.repoUrl!.includes(u)))
      ) {
        throw new Error(`download failed: ${args.repoUrl}`);
      }
      mkdirSync(args.dest, { recursive: true });
      const pkgName =
        (typeof args.identity === "string" && args.identity.split("/").pop()) ||
        (typeof args.repoUrl === "string" &&
          args.repoUrl
            .replace(/\.git$/i, "")
            .split("/")
            .filter(Boolean)
            .pop()) ||
        "fake";
      writeText(
        join(args.dest, "apm.yml"),
        `name: ${pkgName}\nversion: 0.0.0\ndependencies:\n  apm: []\n`,
      );
    },
  };

  return { tagLister, gitRemote, downloader };
}

export { core };
