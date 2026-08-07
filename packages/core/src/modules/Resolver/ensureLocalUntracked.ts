/**
 * Ensure bapm `local` source roots are gitignored (and not already tracked).
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { BapmManifest, DependencyEntry, ObjectDependency } from "@/modules/Manifest";
import { ResolverError } from "./errors.ts";
import { resolveLocalPath } from "./localPath.ts";
import { effectiveLocalPath, localRootGitignorePattern } from "./localSource.ts";

export type EnsureLocalRootUntrackedOptions = {
  projectRoot: string;
  /** Effective local path as declared / expanded (e.g. `.agents/local`, `./alt-local`). */
  originalPath: string;
};

/**
 * Collect effective paths for every root `local` discriminator in the manifest.
 * Plain OpenAPM `path:` entries are ignored.
 */
export function collectLocalSourcePaths(manifest: BapmManifest): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of [manifest.dependencies?.apm, manifest.devDependencies?.apm]) {
    for (const entry of list ?? []) {
      const path = localPathFromEntry(entry);
      if (path === undefined) continue;
      const key = path.replaceAll("\\", "/");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(path);
    }
  }
  return out;
}

function localPathFromEntry(entry: DependencyEntry): string | undefined {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return undefined;
  if (!("local" in entry)) return undefined;
  return effectiveLocalPath((entry as ObjectDependency).local);
}

/**
 * For every `local` source on the root manifest, ensure the effective root is
 * covered by project `.gitignore` and (when `.git` exists) is not tracked.
 */
export function ensureLocalSourcesUntracked(options: {
  projectRoot: string;
  manifest: BapmManifest;
}): void {
  const paths = collectLocalSourcePaths(options.manifest);
  for (const originalPath of paths) {
    ensureLocalRootUntracked({
      projectRoot: options.projectRoot,
      originalPath,
    });
  }
}

/**
 * Ensure one effective local root is ignored; fail closed if git tracks files under it.
 */
export function ensureLocalRootUntracked(options: EnsureLocalRootUntrackedOptions): void {
  const projectRoot = resolve(options.projectRoot);
  const abs = resolveLocalPath({
    originalPath: options.originalPath,
    fromDir: projectRoot,
    projectRoot,
  });
  const rel = relative(projectRoot, abs).replaceAll("\\", "/") || ".";
  const pattern = localRootGitignorePattern(rel === "." ? options.originalPath : rel);
  const gitDir = join(projectRoot, ".git");
  const hasGit = existsSync(gitDir);

  if (hasGit) {
    assertNoTrackedPathsUnder({ projectRoot, rel, pattern });
  }

  if (!isLocalRootIgnored({ projectRoot, abs, rel, pattern, hasGit })) {
    appendGitignorePattern(join(projectRoot, ".gitignore"), pattern);
  }
}

function assertNoTrackedPathsUnder(args: {
  projectRoot: string;
  rel: string;
  pattern: string;
}): void {
  let out: string;
  try {
    out = execFileSync("git", ["ls-files", "-z", "--", args.rel], {
      cwd: args.projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new ResolverError(
      "RESOLVE_FAILED",
      `Failed to query git for tracked files under local root "${args.rel}": ${message}`,
      {
        details: { localRoot: args.rel, pattern: args.pattern },
        cause,
      },
    );
  }

  if (out.length === 0) return;

  throw new ResolverError(
    "LOCAL_ROOT_TRACKED",
    `Local source root "${args.rel}" has tracked files under git. ` +
      `Untrack with \`git rm -r --cached -- ${args.rel}\` and keep a covering .gitignore rule ` +
      `(e.g. ${args.pattern}). Prefer OpenAPM \`path:\` if this tree should remain tracked.`,
    {
      details: {
        localRoot: args.rel,
        pattern: args.pattern,
        guidance: "git rm --cached",
      },
    },
  );
}

function isLocalRootIgnored(args: {
  projectRoot: string;
  abs: string;
  rel: string;
  pattern: string;
  hasGit: boolean;
}): boolean {
  if (args.hasGit) {
    try {
      execFileSync("git", ["check-ignore", "-q", "--", args.rel], {
        cwd: args.projectRoot,
        stdio: "ignore",
      });
      return true;
    } catch {
      // exit 1 → not ignored; fall through to pattern scan / append
    }
  }

  const gitignorePath = join(args.projectRoot, ".gitignore");
  if (!existsSync(gitignorePath)) return false;
  const content = readFileSync(gitignorePath, "utf8").replaceAll("\\", "/");
  const needle = args.rel.replace(/^\.\//, "");
  return (
    content.includes(args.pattern) ||
    content.includes(`/${needle}/`) ||
    content.includes(`${needle}/`) ||
    content.includes(needle)
  );
}

function appendGitignorePattern(gitignorePath: string, pattern: string): void {
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${pattern}\n`, "utf8");
    return;
  }
  const existing = readFileSync(gitignorePath, "utf8");
  const prefix = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  appendFileSync(gitignorePath, `${prefix}${pattern}\n`, "utf8");
}
