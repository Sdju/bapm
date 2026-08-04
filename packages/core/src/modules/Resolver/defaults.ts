import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Downloader, GitRemote, TagLister } from "./types.ts";
import { identityToCacheDir, normalizeRepoIdentity } from "./identity.ts";
import { APM_MODULES_DIR } from "./constants.ts";

/** Default TagLister via `git ls-remote --tags`. */
export function createDefaultTagLister(): TagLister {
  return {
    async listTags(repoUrl: string) {
      const out = await runGit(["ls-remote", "--tags", "--refs", repoUrl]);
      const tags: Array<{ tag: string; commit: string }> = [];
      for (const line of out.split("\n")) {
        const m = line.match(/^([0-9a-f]{40})\s+refs\/tags\/(.+)$/i);
        if (m) tags.push({ commit: m[1]!.toLowerCase(), tag: m[2]! });
      }
      return tags;
    },
  };
}

/** Default GitRemote via `git ls-remote`. */
export function createDefaultGitRemote(): GitRemote {
  return {
    async resolveRef(repoUrl: string, ref: string) {
      if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
      const out = await runGit(["ls-remote", repoUrl, ref]);
      const line = out.split("\n").find((l) => l.trim().length > 0);
      if (!line) {
        // try refs/heads and refs/tags
        const out2 = await runGit(["ls-remote", repoUrl, `refs/heads/${ref}`, `refs/tags/${ref}`]);
        const line2 = out2.split("\n").find((l) => l.trim().length > 0);
        if (!line2) throw new Error(`Unable to resolve ref ${ref} for ${repoUrl}`);
        return line2.split(/\s+/)[0]!.toLowerCase();
      }
      return line.split(/\s+/)[0]!.toLowerCase();
    },
  };
}

/** Default Downloader: local copy or shallow git clone into apm_modules. */
export function createDefaultDownloader(): Downloader {
  return {
    async download(args) {
      mkdirSync(args.dest, { recursive: true });
      if (args.path) {
        if (!existsSync(args.path)) {
          throw new Error(`Local path not found: ${args.path}`);
        }
        cpSync(args.path, args.dest, { recursive: true });
        return;
      }
      if (!args.repoUrl) {
        throw new Error("download requires repoUrl or path");
      }
      // Clone into temp then checkout commit if provided
      const url = args.repoUrl;
      await runGit(["clone", "--quiet", url, args.dest], { allowFail: false });
      if (args.commit) {
        await runGit(["-C", args.dest, "checkout", "--quiet", args.commit]);
      }
    },
  };
}

export function modulesCacheDest(cwd: string, identity: string, commit?: string): string {
  const base = join(cwd, APM_MODULES_DIR, identityToCacheDir(identity));
  if (commit) return join(base, commit.slice(0, 12));
  return base;
}

export function ensureModulesRoot(cwd: string): string {
  const root = join(cwd, APM_MODULES_DIR);
  mkdirSync(root, { recursive: true });
  return root;
}

async function runGit(args: string[], options?: { allowFail?: boolean }): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && options?.allowFail !== true) {
        reject(new Error(`git ${args.join(" ")} failed: ${stderr || stdout}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export { normalizeRepoIdentity };
