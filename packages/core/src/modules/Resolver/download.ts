import { resolve } from "node:path";
import { APM_MODULES_DIR, DEFAULT_PARALLEL_DOWNLOADS } from "./constants.ts";
import { createDefaultDownloader, ensureModulesRoot, modulesCacheDest } from "./defaults.ts";
import { ResolverError } from "./errors.ts";
import { normalizeRepoIdentity } from "./identity.ts";
import type { DownloadPackagesOptions, Downloader } from "./types.ts";

/**
 * Materialize packages into `<cwd>/apm_modules/` via Downloader port.
 */
export async function downloadPackages(options: DownloadPackagesOptions): Promise<string[]> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const downloader: Downloader = options.downloader ?? createDefaultDownloader();
  const parallel = options.parallelDownloads ?? DEFAULT_PARALLEL_DOWNLOADS;

  ensureModulesRoot(cwd);
  const dests: string[] = [];

  const work = options.packages.map((pkg) => async () => {
    const identity =
      pkg.identity ??
      (pkg.repoUrl
        ? normalizeRepoIdentity(pkg.repoUrl)
        : pkg.path
          ? `local:${pkg.path}`
          : "unknown");
    const dest = modulesCacheDest(cwd, identity.replace(/^local:/, "local_"), pkg.commit);
    try {
      await downloader.download({
        repoUrl: pkg.repoUrl,
        path: pkg.path,
        commit: pkg.commit,
        dest,
        identity,
      });
    } catch (cause) {
      throw new ResolverError(
        "DOWNLOAD_FAILED",
        `Failed to download ${pkg.repoUrl ?? pkg.path ?? identity}`,
        { cause },
      );
    }
    dests.push(dest);
    return dest;
  });

  await runPool(work, parallel);
  // Ensure modules dir exists even for empty package list callers that only check dir
  if (options.packages.length === 0) {
    ensureModulesRoot(cwd);
  }
  return dests;
}

export { APM_MODULES_DIR };

async function runPool(tasks: Array<() => Promise<unknown>>, concurrency: number): Promise<void> {
  const n = Math.max(1, concurrency);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      await tasks[idx]!();
    }
  });
  await Promise.all(workers);
}
