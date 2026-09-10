import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { loadAgentPluginManifest, AgentPluginsError } from "@/modules/AgentPlugins";
import { APM_MODULES_DIR, identityToCacheDir, type ResolvedNode } from "@/modules/Resolver";
import { CopilotNativeRegistrationError } from "./errors.ts";
import type { AdmittedCopilotNativePlugin } from "./types.ts";

/**
 * Admit portable Agent Plugin roots from resolved nodes for Copilot native registration.
 * Invalid plugin.json that claims the portable path fails closed.
 * Same plugin name: direct (lower depth) wins; same precedence → collision.
 */
export function admitCopilotNativePlugins(
  nodes: ResolvedNode[],
  options?: { cwd?: string },
): AdmittedCopilotNativePlugin[] {
  const cwd = resolve(options?.cwd ?? process.cwd());
  const claimants: AdmittedCopilotNativePlugin[] = [];

  for (const node of nodes) {
    const root = portablePluginRoot(node);
    if (!root) continue;

    let pluginName: string;
    try {
      const loaded = loadAgentPluginManifest({ root });
      pluginName = loaded.manifest.name;
    } catch (cause) {
      const detail =
        cause instanceof AgentPluginsError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : String(cause);
      throw new CopilotNativeRegistrationError(
        "COPILOT_NATIVE_ADMISSION_INVALID",
        `Invalid portable Agent Plugin root for Copilot native registration (${node.name}): ${detail}`,
        {
          details: { packageName: node.name, packageRoot: root },
          cause,
        },
      );
    }

    const packageRoot = resolveModulesPackageRoot(cwd, node, root);
    const packagePathRel = toModulesRelative(cwd, packageRoot, node);
    claimants.push({
      pluginName,
      packageName: node.name,
      packageRoot,
      packagePathRel,
      depth: node.depth ?? 99,
      identity: node.identity,
    });
  }

  return resolvePluginNameCollisions(claimants);
}

/**
 * Prefer lower depth (direct over transitive). Same depth → fail closed.
 */
export function resolvePluginNameCollisions(
  claimants: AdmittedCopilotNativePlugin[],
): AdmittedCopilotNativePlugin[] {
  const byName = new Map<string, AdmittedCopilotNativePlugin[]>();
  for (const c of claimants) {
    const list = byName.get(c.pluginName) ?? [];
    list.push(c);
    byName.set(c.pluginName, list);
  }

  const admitted: AdmittedCopilotNativePlugin[] = [];
  for (const [pluginName, list] of byName) {
    if (list.length === 1) {
      admitted.push(list[0]!);
      continue;
    }
    const minDepth = Math.min(...list.map((c) => c.depth));
    const winners = list.filter((c) => c.depth === minDepth);
    if (winners.length > 1) {
      const packages = winners.map((c) => c.packageName).join(", ");
      throw new CopilotNativeRegistrationError(
        "COPILOT_NATIVE_PLUGIN_COLLISION",
        `Same-precedence portable plugin name collision for "${pluginName}" (packages: ${packages})`,
        {
          details: {
            pluginName,
            packages: winners.map((c) => c.packageName),
            depth: minDepth,
          },
        },
      );
    }
    admitted.push(winners[0]!);
  }

  return admitted.sort((a, b) => a.pluginName.localeCompare(b.pluginName));
}

export function portablePluginRoot(node: ResolvedNode): string | undefined {
  for (const candidate of [node.packageRoot, node.path]) {
    if (candidate && existsSync(join(candidate, "plugin.json"))) return candidate;
  }
  return undefined;
}

/** Prefer materialized modules tree for live-load catalog paths. */
function resolveModulesPackageRoot(cwd: string, node: ResolvedNode, fallbackRoot: string): string {
  const candidates: string[] = [];
  if (node.packageRoot) candidates.push(resolve(node.packageRoot));
  if (node.identity?.startsWith("local:")) {
    const localId = node.identity.replace(/^local:/, "local_");
    candidates.push(join(cwd, APM_MODULES_DIR, identityToCacheDir(localId)));
  }
  if (node.name) candidates.push(join(cwd, APM_MODULES_DIR, node.name));
  candidates.push(resolve(fallbackRoot));

  for (const c of candidates) {
    if (existsSync(join(c, "plugin.json")) && isUnderModules(cwd, c)) return c;
  }
  for (const c of candidates) {
    if (existsSync(join(c, "plugin.json"))) return c;
  }
  return resolve(fallbackRoot);
}

function toModulesRelative(cwd: string, packageRoot: string, node: ResolvedNode): string {
  const rel = relative(cwd, packageRoot).replace(/\\/g, "/");
  if (rel === APM_MODULES_DIR || rel.startsWith(`${APM_MODULES_DIR}/`)) return rel;

  if (node.identity?.startsWith("local:")) {
    const localId = node.identity.replace(/^local:/, "local_");
    return join(APM_MODULES_DIR, identityToCacheDir(localId)).replace(/\\/g, "/");
  }
  if (node.packageRoot) {
    const pr = relative(cwd, resolve(node.packageRoot)).replace(/\\/g, "/");
    if (pr === APM_MODULES_DIR || pr.startsWith(`${APM_MODULES_DIR}/`)) return pr;
  }
  return join(APM_MODULES_DIR, node.name || "unknown").replace(/\\/g, "/");
}

function isUnderModules(cwd: string, abs: string): boolean {
  const rel = relative(cwd, abs).replace(/\\/g, "/");
  return rel === APM_MODULES_DIR || rel.startsWith(`${APM_MODULES_DIR}/`);
}
