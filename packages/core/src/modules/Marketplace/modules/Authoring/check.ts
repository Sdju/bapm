import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { MarketplaceAuthoringError } from "./errors.ts";
import { loadMarketplaceAuthoringConfig } from "./detect.ts";
import { loadMarketplaceFromBapmYml } from "./load.ts";
import {
  githubHttpsUrlFromOwnerRepo,
  isGithubOwnerRepoShorthand,
  isLocalAuthoringSource,
  splitHostFromAuthoringSource,
} from "./source.ts";
import type {
  CheckMarketplaceAuthoringOptions,
  CheckMarketplaceAuthoringResult,
} from "./types.ts";

async function defaultLsRemote(repoUrl: string, ref?: string): Promise<void> {
  const args = ref ? ["ls-remote", repoUrl, ref] : ["ls-remote", repoUrl, "HEAD"];
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 || !stdout.trim()) {
        reject(
          new Error(
            `git ls-remote failed / unreachable / not found for ${repoUrl}: ${stderr.trim() || `exit ${code}`}`,
          ),
        );
        return;
      }
      resolvePromise();
    });
  });
}

/**
 * Authoring check: schema load; offline = no network; online github owner/repo via ls-remote.
 * Non-github remotes: fail-soft warning (design D5).
 */
export async function checkMarketplaceAuthoring(
  options: CheckMarketplaceAuthoringOptions = {},
): Promise<CheckMarketplaceAuthoringResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const errors: string[] = [];
  const warnings: string[] = [];
  const offline = Boolean(options.offline);
  const lsRemote = options.lsRemote ?? defaultLsRemote;

  let config;
  try {
    if (options.path) {
      const loaded = loadMarketplaceFromBapmYml({ cwd, path: options.path });
      config = loaded.config;
    } else {
      const loaded = loadMarketplaceAuthoringConfig({ cwd });
      config = loaded.config;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const exitCode = err instanceof MarketplaceAuthoringError ? err.exitCode : 2;
    return { ok: false, exitCode, errors: [message], warnings };
  }

  if (offline) {
    return { ok: true, exitCode: 0, errors, warnings };
  }

  for (const pkg of config.packages) {
    if (isLocalAuthoringSource(pkg.source) || pkg.isLocal) {
      continue;
    }

    if (isGithubOwnerRepoShorthand(pkg.source)) {
      const url = githubHttpsUrlFromOwnerRepo(pkg.source);
      try {
        await lsRemote(url, pkg.ref);
      } catch (err) {
        errors.push(
          `Package '${pkg.name}' source '${pkg.source}': ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      continue;
    }

    const { host, repoPath } = splitHostFromAuthoringSource(pkg.source);
    if (host === "github.com" || host?.endsWith(".ghe.com")) {
      const url = `https://${host}/${repoPath}.git`;
      try {
        await lsRemote(url, pkg.ref);
      } catch (err) {
        errors.push(
          `Package '${pkg.name}' source '${pkg.source}': ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      continue;
    }

    warnings.push(
      `Package '${pkg.name}' source '${pkg.source}': online check unsupported for this host; ` +
        `schema-only (use --offline to silence network attempts / warning).`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, exitCode: 2, errors, warnings };
  }
  return { ok: true, exitCode: 0, errors, warnings };
}

export const checkAuthoringMarketplace = checkMarketplaceAuthoring;
export const runMarketplaceAuthoringCheck = checkMarketplaceAuthoring;
