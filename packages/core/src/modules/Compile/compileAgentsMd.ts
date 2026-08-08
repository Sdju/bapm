import { join, resolve } from "node:path";
import type { BapmIntegration, IntegrationRegistry } from "@bapm/integration-api";
import { loadManifest } from "@/modules/Manifest";
import {
  discoverPrimitives,
  resolvePrimitiveConflicts,
  type AttributedPrimitive,
} from "@/modules/Primitives";
import { APM_MODULES_DIR } from "@/modules/Resolver";
import type {
  CompileAgentsMdOptions,
  CompileAgentsMdResult,
  CompileAttributionEntry,
} from "./types.ts";

/**
 * Discover conflict-resolved primitives then delegate output emission to a
 * selected registered target capability.
 */
export async function compileAgentsMd(
  options: CompileAgentsMdOptions = {},
): Promise<CompileAgentsMdResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const modulesDir = options.modulesDir ?? join(cwd, APM_MODULES_DIR);

  const raw = discoverPrimitives({ cwd, modulesDir });
  const { primitives } = resolvePrimitiveConflicts({ primitives: raw });
  const sorted = sortPrimitives(primitives);
  const attribution = toAttribution(sorted);
  const target = await selectCompileTarget(options.integrationRegistry, options.forcedTarget, cwd);
  if (typeof target.compile !== "function") {
    throw new Error(`Target "${target.id}" does not support compile`);
  }
  const emitted = await target.compile(sorted, {
    cwd,
    outputFile: options.outputFile,
    write: options.validate !== true && options.dryRun !== true,
  });

  return {
    ok: true,
    path: emitted.path,
    content: emitted.content,
    wrote: emitted.wrote,
    primitivesCount: sorted.length,
    attribution,
  };
}

export const compileProject = compileAgentsMd;
export const runCompile = compileAgentsMd;
export const emitAgentsMd = compileAgentsMd;

function toAttribution(primitives: AttributedPrimitive[]): CompileAttributionEntry[] {
  return primitives.map((p) => {
    const entry: CompileAttributionEntry = {
      name: String(p.name ?? "unnamed"),
      type: String(p.type ?? "primitive"),
    };
    const path = typeof p.path === "string" ? p.path.trim() : "";
    if (path) entry.path = path;
    return entry;
  });
}

function sortPrimitives(primitives: AttributedPrimitive[]): AttributedPrimitive[] {
  return [...primitives].sort((a, b) => {
    const ta = String(a.type ?? "");
    const tb = String(b.type ?? "");
    if (ta !== tb) return ta.localeCompare(tb);
    const na = String(a.name ?? "");
    const nb = String(b.name ?? "");
    if (na !== nb) return na.localeCompare(nb);
    return String(a.path ?? "").localeCompare(String(b.path ?? ""));
  });
}

function readManifestActive(cwd: string): string[] | undefined {
  try {
    const { document } = loadManifest({ cwd });
    return document.active;
  } catch {
    return undefined;
  }
}

async function selectCompileTarget(
  registry: IntegrationRegistry | undefined,
  forcedTarget: string | undefined,
  cwd: string,
): Promise<BapmIntegration> {
  if (!registry) {
    throw new Error(
      "Compile requires a registered target; pass --target <id> or set active in the manifest",
    );
  }

  // 1. Forced --target
  if (forcedTarget) {
    const target = registry.get(forcedTarget);
    if (!target) throw new Error(`Unknown or unregistered target: ${forcedTarget}`);
    return target;
  }

  // 2. Manifest `active` — sole compile-capable id, or fail if multi
  const manifestActive = readManifestActive(cwd);
  if (manifestActive && manifestActive.length > 0) {
    if (manifestActive.length > 1) {
      // Multi-active without force: do not fall through to detect.
      throw new Error(
        "Manifest active lists multiple hosts; pass --target <id> to select one for compile",
      );
    }

    const soleId = manifestActive[0]!;
    const sole = registry.get(soleId);
    if (!sole) throw new Error(`Unknown or unregistered target: ${soleId}`);
    if (typeof sole.compile !== "function") {
      throw new Error(`Target "${sole.id}" does not support compile`);
    }
    return sole;
  }

  // 3. Sole auto-detect among compile-capable registered hosts
  const detection = await detectRegisteredTargets(registry, cwd);
  const candidates = detection.detectedIds
    .map((id) => registry.get(id))
    .filter((target): target is BapmIntegration => Boolean(target?.compile));
  if (candidates.length !== 1) {
    throw new Error(
      "Target detection is missing or ambiguous; pass --target <id> or set active in the manifest",
    );
  }
  return candidates[0]!;
}

async function detectRegisteredTargets(
  registry: IntegrationRegistry,
  cwd: string,
): Promise<{ detectedIds: string[] }> {
  if (typeof registry.detect === "function") return registry.detect(cwd);

  const detectedIds: string[] = [];
  for (const target of registry.list()) {
    try {
      if (await target.detect({ cwd })) detectedIds.push(target.id);
    } catch {
      // Detection errors are documented non-matches.
    }
  }
  return { detectedIds };
}
