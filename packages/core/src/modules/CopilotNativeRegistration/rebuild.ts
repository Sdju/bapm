import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { loadAgentPluginManifest } from "@/modules/AgentPlugins";
import { loadEffectiveLockfileOrNull } from "@/modules/Lockfile";
import {
  APM_MODULES_DIR,
  identityToCacheDir,
  normalizeRepoIdentity,
  type ResolvedNode,
} from "@/modules/Resolver";
import { admitCopilotNativePlugins, resolvePluginNameCollisions } from "./admit.ts";
import {
  clearCopilotNativeCatalogArtifacts,
  writeCopilotNativeCatalog,
  writeCopilotNativeLedger,
} from "./catalog.ts";
import {
  mergeCopilotNativeSettings,
  retireCopilotNativeSettings,
  assertCopilotNativeSettingsWritable,
} from "./settings.ts";
import type {
  AdmittedCopilotNativePlugin,
  RebuildCopilotNativeRegistrationOptions,
  SyncCopilotNativeRegistrationOptions,
} from "./types.ts";

/**
 * Rebuild or clear owned catalog/ledger/settings for the admitted set.
 * Empty admitted set retires owned registration artifacts.
 */
export function rebuildCopilotNativeRegistration(
  options: RebuildCopilotNativeRegistrationOptions,
): void {
  if (options.dryRun === true) return;

  const cwd = resolve(options.cwd);
  const admitted = options.admitted;

  if (admitted.length === 0) {
    assertCopilotNativeSettingsWritable(cwd);
    clearCopilotNativeCatalogArtifacts(cwd);
    retireCopilotNativeSettings(cwd, []);
    return;
  }

  assertCopilotNativeSettingsWritable(cwd);
  writeCopilotNativeCatalog(cwd, admitted);
  writeCopilotNativeLedger(cwd, admitted);
  mergeCopilotNativeSettings(cwd, admitted);
}

/**
 * Sync registration from current lock + on-disk package roots (uninstall/prune).
 */
export function syncCopilotNativeRegistrationFromLock(
  options: SyncCopilotNativeRegistrationOptions,
): void {
  if (options.dryRun === true) return;
  const cwd = resolve(options.cwd);
  const admitted = admitFromLockfile(cwd);
  rebuildCopilotNativeRegistration({ cwd, admitted, dryRun: false });
}

/**
 * Admit from install-time resolver nodes when Copilot is an effective target.
 */
export function rebuildCopilotNativeRegistrationFromNodes(
  cwd: string,
  nodes: ResolvedNode[],
  options?: { dryRun?: boolean },
): AdmittedCopilotNativePlugin[] {
  const admitted = admitCopilotNativePlugins(nodes, { cwd });
  rebuildCopilotNativeRegistration({
    cwd,
    admitted,
    dryRun: options?.dryRun === true,
  });
  return admitted;
}

function admitFromLockfile(cwd: string): AdmittedCopilotNativePlugin[] {
  const loaded = loadEffectiveLockfileOrNull({ cwd });
  const claimants: AdmittedCopilotNativePlugin[] = [];

  for (const dep of loaded?.document.dependencies ?? []) {
    const packageName = typeof dep.name === "string" ? dep.name : "";
    if (!packageName) continue;
    const root = resolveLockPackageRoot(cwd, dep);
    if (!root || !existsSync(join(root, "plugin.json"))) continue;

    try {
      const loadedManifest = loadAgentPluginManifest({ root });
      const packagePathRel = relative(cwd, root).replace(/\\/g, "/");
      const depthRaw = (dep as { depth?: unknown }).depth;
      claimants.push({
        pluginName: loadedManifest.manifest.name,
        packageName,
        packageRoot: root,
        packagePathRel: packagePathRel.startsWith(APM_MODULES_DIR)
          ? packagePathRel
          : join(APM_MODULES_DIR, packageName),
        depth: typeof depthRaw === "number" ? depthRaw : 1,
        identity: typeof dep.repo_url === "string" ? dep.repo_url : undefined,
      });
    } catch {
      // Skip invalid roots on lifecycle sync — they are no longer install-admitted.
    }
  }

  return resolvePluginNameCollisions(claimants);
}

function resolveLockPackageRoot(
  cwd: string,
  dep: { name?: unknown; repo_url?: unknown; path?: unknown; resolved_commit?: unknown },
): string | undefined {
  const candidates: string[] = [];
  const name = typeof dep.name === "string" ? dep.name : "";
  const repo = typeof dep.repo_url === "string" ? dep.repo_url : "";
  const commit = typeof dep.resolved_commit === "string" ? dep.resolved_commit : undefined;

  if (name) candidates.push(join(cwd, APM_MODULES_DIR, name));

  if (repo.startsWith("local:")) {
    const localId = repo.replace(/^local:/, "local_");
    candidates.push(join(cwd, APM_MODULES_DIR, identityToCacheDir(localId)));
  } else if (repo) {
    try {
      const id = normalizeRepoIdentity(repo.includes("://") ? repo : `https://${repo}`);
      const base = join(cwd, APM_MODULES_DIR, identityToCacheDir(id));
      candidates.push(base);
      if (commit) candidates.push(join(base, commit.slice(0, 12)));
    } catch {
      /* ignore */
    }
  }

  if (typeof dep.path === "string" && dep.path) {
    candidates.push(resolve(cwd, dep.path));
  }

  for (const c of candidates) {
    if (existsSync(c) && existsSync(join(c, "plugin.json"))) return c;
  }
  return undefined;
}
