/**
 * M3 acceptance helpers — temp projects, fake ports, flexible result accessors.
 * Public API under test (design): classifyDependencyRef, resolveDependencyGraph,
 * downloadPackages, resolveAndLock, MAX_RESOLVE_DEPTH, APM_MODULES_DIR.
 */
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  cpSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const fixturesDir = join(suiteDir, "fixtures");

export function fixturePath(...parts: string[]): string {
  return join(fixturesDir, ...parts);
}

export function readFixture(...parts: string[]): string {
  return readFileSync(fixturePath(...parts), "utf8");
}

export type TempProject = {
  cwd: string;
  cleanup: () => void;
};

export function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-m3-accept-"));
  return {
    cwd,
    cleanup: () => {
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
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

export function writeLock(
  cwd: string,
  filename: "apm.lock.yaml" | "bapm.lock.yaml",
  contents: string,
): string {
  const path = join(cwd, filename);
  writeFileSync(path, contents, "utf8");
  return path;
}

export function writeText(path: string, contents: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, contents, "utf8");
}

export function copyMiniMonorepo(dest: string): void {
  cpSync(fixturePath("mini-monorepo"), dest, { recursive: true });
}

/** 40-hex fake commit for fixture pins. */
export function fakeCommit(seed: string): string {
  const hex = seed
    .split("")
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .replace(/[^0-9a-f]/gi, "a")
    .toLowerCase()
    .padEnd(40, "0")
    .slice(0, 40);
  return hex;
}

export type FakeTag = { tag: string; commit: string };

/**
 * Fake TagLister / GitRemote / Downloader ports for deterministic acceptance.
 * Shape is intentional: apply implements matching injectable ports.
 */
export function createFakePorts(options?: {
  tagsByRepo?: Record<string, FakeTag[]>;
  commitsByRef?: Record<string, string>;
  failUrls?: string[];
}) {
  const tagsByRepo = options?.tagsByRepo ?? {};
  const commitsByRef = options?.commitsByRef ?? {};
  const failUrls = new Set(options?.failUrls ?? []);
  const lsRemoteCalls: string[] = [];
  const tagListCalls: string[] = [];
  const downloadCalls: Array<{ repo: string; commit?: string; dest?: string }> = [];

  const tagLister = {
    async listTags(repoUrl: string): Promise<FakeTag[]> {
      tagListCalls.push(repoUrl);
      const key = Object.keys(tagsByRepo).find((k) => repoUrl.includes(k) || k.includes(repoUrl));
      return tagsByRepo[key ?? repoUrl] ?? tagsByRepo["*"] ?? [];
    },
  };

  const gitRemote = {
    async resolveRef(repoUrl: string, ref: string): Promise<string> {
      lsRemoteCalls.push(`${repoUrl}#${ref}`);
      if (failUrls.has(repoUrl) || [...failUrls].some((u) => repoUrl.includes(u))) {
        throw new Error(`git remote failed: ${repoUrl}`);
      }
      const key = `${repoUrl}#${ref}`;
      if (commitsByRef[key]) return commitsByRef[key];
      if (commitsByRef[ref]) return commitsByRef[ref];
      // Literal 40-hex ref
      if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
      return fakeCommit(`${repoUrl}:${ref}`);
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
      downloadCalls.push({
        repo: args.repoUrl ?? args.path ?? "",
        commit: args.commit,
        dest: args.dest,
      });
      if (args.repoUrl && (failUrls.has(args.repoUrl) || [...failUrls].some((u) => args.repoUrl!.includes(u)))) {
        throw new Error(`download failed: ${args.repoUrl}`);
      }
      ensureDir(args.dest);
      if (args.path && existsSync(args.path)) {
        cpSync(args.path, args.dest, { recursive: true });
        return;
      }
      writeText(
        join(args.dest, "apm.yml"),
        `name: fake\nversion: 0.0.0\ndependencies:\n  apm: []\n`,
      );
      if (args.commit) {
        writeText(join(args.dest, ".bapm-resolved-commit"), args.commit);
      }
    },
  };

  return {
    tagLister,
    gitRemote,
    downloader,
    lsRemoteCalls,
    tagListCalls,
    downloadCalls,
  };
}

export function lockOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected lock/result object");
  }
  const r = result as Record<string, unknown>;
  const doc = (r.document ?? r.lockfile ?? r.lock ?? r) as Record<string, unknown>;
  if (doc === null || typeof doc !== "object") {
    throw new TypeError("expected document/lockfile object");
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

export function graphNodes(result: unknown): Record<string, unknown>[] {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected resolve result object");
  }
  const r = result as Record<string, unknown>;
  const nodes = (r.nodes ?? r.packages ?? r.dependencies ?? r.graph ?? r) as unknown;
  if (Array.isArray(nodes)) return nodes as Record<string, unknown>[];
  if (nodes && typeof nodes === "object") {
    return Object.values(nodes as Record<string, unknown>) as Record<string, unknown>[];
  }
  throw new TypeError("expected nodes/packages array on resolve result");
}

export function walkOrder(result: unknown): string[] {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected resolve result");
  }
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.visitOrder)) return r.visitOrder.map(String);
  if (Array.isArray(r.declarationOrder)) return r.declarationOrder.map(String);
  // Fall back: depth-1 nodes in array order
  const nodes = graphNodes(result).filter((n) => Number(n.depth ?? n.level ?? 0) === 1);
  return nodes.map((n) => String(n.name ?? n.id ?? n.alias ?? n.repo_url ?? n.spec));
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

export async function expectRejectsMatching(
  fn: () => Promise<unknown>,
  pattern: RegExp,
): Promise<unknown> {
  let thrown: unknown;
  try {
    await fn();
  } catch (e) {
    thrown = e;
  }
  if (thrown === undefined) {
    throw new Error(`expected reject matching ${pattern}`);
  }
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

export function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p.slice(root.length + 1));
    }
  };
  walk(root);
  return out.sort();
}

export function isFortyHex(value: unknown): boolean {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}
