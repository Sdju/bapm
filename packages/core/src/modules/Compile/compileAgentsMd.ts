import { join, resolve } from "node:path";
import type { BapmIntegration, IntegrationRegistry } from "@b-apm/integration-api";
import { loadManifest, resolveActive } from "@/modules/Manifest";
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
  CompileOutput,
} from "./types.ts";

type ResolvedCompileTarget = Pick<BapmIntegration, "id" | "compile">;

/**
 * Discover conflict-resolved primitives then delegate output emission to one
 * or more registered target capabilities.
 *
 * Single-target callers keep the `path` / `content` / `wrote` result fields;
 * `outputs` always lists every emitted host (one entry for single-target runs).
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

  const targets = await selectCompileTargets(options, cwd);
  const multi = targets.length > 1;
  if (multi && options.outputFile?.trim()) {
    throw new Error(
      "Compile with multiple compile targets cannot use one --output path; select a single target or omit -o / --output",
    );
  }

  const write = options.validate !== true && options.dryRun !== true;
  const compileContext = {
    cwd,
    outputFile: options.outputFile,
  } as const;

  let outputs: CompileOutput[];
  let firstContent = "";

  if (!multi) {
    const target = targets[0]!;
    const emitted = await target.compile!(sorted, { ...compileContext, write });
    firstContent = emitted.content;
    outputs = [{ targetId: target.id, path: emitted.path, wrote: emitted.wrote }];
  } else {
    // Preflight: render without writing so output paths are known before any
    // file is touched. Collisions fail closed instead of last-writer-wins.
    const previews = await Promise.all(
      targets.map(async (target) => ({
        target,
        emitted: await target.compile!(sorted, { ...compileContext, write: false }),
      })),
    );
    assertNoOutputCollision(cwd, previews);

    if (write) {
      const written = await Promise.all(
        previews.map(async ({ target, emitted }) => {
          const durable = await target.compile!(sorted, { ...compileContext, write: true });
          return {
            targetId: target.id,
            path: durable.path,
            wrote: durable.wrote,
            content: durable.content,
          };
        }),
      );
      firstContent = written[0]?.content ?? "";
      outputs = written.map(({ targetId, path, wrote }) => ({ targetId, path, wrote }));
    } else {
      firstContent = previews[0]?.emitted.content ?? "";
      outputs = previews.map(({ target, emitted }) => ({
        targetId: target.id,
        path: emitted.path,
        wrote: emitted.wrote,
      }));
    }
  }

  return {
    ok: true,
    path: outputs[0]?.path,
    content: firstContent,
    wrote: outputs.length > 0 && outputs.every((output) => output.wrote),
    primitivesCount: sorted.length,
    attribution,
    outputs,
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

function assertNoOutputCollision(
  cwd: string,
  previews: Array<{ target: ResolvedCompileTarget; emitted: { path: string } }>,
): void {
  const byPath = new Map<string, Array<{ targetId: string; path: string }>>();
  for (const { target, emitted } of previews) {
    const key = resolve(cwd, emitted.path);
    const hosts = byPath.get(key) ?? [];
    hosts.push({ targetId: String(target.id), path: emitted.path });
    byPath.set(key, hosts);
  }

  for (const hosts of byPath.values()) {
    if (hosts.length < 2) continue;
    const path = hosts[0]!.path;
    const ids = hosts.map((host) => host.targetId);
    throw new Error(
      `Compile target collision: hosts ${ids.map((id) => `"${id}"`).join(", ")} all write "${path}". ` +
        "Refusing to overwrite one host's output with another; select one host per output path or exclude duplicates.",
    );
  }
}

function readManifestActive(cwd: string): string[] | undefined {
  try {
    const { document } = loadManifest({ cwd });
    const { targetIds } = resolveActive(document);
    return targetIds.length > 0 ? targetIds : undefined;
  } catch {
    return undefined;
  }
}

async function selectCompileTargets(
  options: CompileAgentsMdOptions,
  cwd: string,
): Promise<ResolvedCompileTarget[]> {
  const registry = options.integrationRegistry;
  if (!registry) {
    throw new Error(
      "Compile requires a registered target; pass --target <id> or set active in the manifest",
    );
  }

  if (options.all === true) {
    if (options.forcedTarget || options.forcedTargets?.length) {
      throw new Error("Compile accepts either --all or --target, not both");
    }
    const targets = registry
      .list()
      .filter(
        (
          target,
        ): target is BapmIntegration & { compile: NonNullable<BapmIntegration["compile"]> } =>
          typeof target.compile === "function",
      )
      .map((target) => ({ id: target.id, compile: target.compile }));
    if (targets.length === 0) {
      throw new Error(
        "Compile --all found no registered compile-capable targets; register host integrations first",
      );
    }
    return targets;
  }

  const forcedIds = normalizeForcedTargets(options.forcedTargets);
  if (options.forcedTarget && forcedIds.length > 0) {
    throw new Error("Compile accepts either forcedTarget or forcedTargets, not both");
  }
  if (forcedIds.length > 0) {
    return forcedIds.map((id) => resolveCompileTarget(registry, id));
  }

  const single = await selectCompileTarget(
    registry,
    options.forcedTarget,
    cwd,
    options.configTarget,
  );
  return [single];
}

function normalizeForcedTargets(forcedTargets: string[] | undefined): string[] {
  if (forcedTargets === undefined) return [];
  const ids = forcedTargets.map((id) => String(id ?? "").trim()).filter((id) => id.length > 0);
  if (ids.length !== forcedTargets.length || ids.length === 0) {
    throw new Error("Compile forcedTargets must contain at least one non-empty target id");
  }
  return [...new Set(ids)];
}

function resolveCompileTarget(registry: IntegrationRegistry, id: string): ResolvedCompileTarget {
  const target = registry.get(id);
  if (!target) throw new Error(`Unknown or unregistered target: ${id}`);
  if (typeof target.compile !== "function") {
    throw new Error(`Target "${target.id}" does not support compile`);
  }
  return { id: target.id, compile: target.compile };
}

async function selectCompileTarget(
  registry: IntegrationRegistry,
  forcedTarget: string | undefined,
  cwd: string,
  configTarget?: string,
): Promise<ResolvedCompileTarget> {
  // 1. Forced --target
  if (forcedTarget) {
    return resolveCompileTarget(registry, forcedTarget);
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
    return resolveCompileTarget(registry, soleId);
  }

  // 3. User config default target (before detect)
  const configured = configTarget?.trim();
  if (configured) {
    return resolveCompileTarget(registry, configured);
  }

  // 4. Sole auto-detect among compile-capable registered hosts
  const detection = await detectRegisteredTargets(registry, cwd);
  const candidates = detection.detectedIds
    .map((id) => registry.get(id))
    .filter((target): target is BapmIntegration => Boolean(target?.compile));
  if (candidates.length !== 1) {
    throw new Error(
      "Target detection is missing or ambiguous; pass --target <id> or set active in the manifest",
    );
  }
  return { id: candidates[0]!.id, compile: candidates[0]!.compile! };
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
