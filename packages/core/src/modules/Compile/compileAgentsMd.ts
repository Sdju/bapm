import { basename, dirname, join, resolve } from "node:path";
import type { BapmIntegration, IntegrationRegistry } from "@b-apm/integration-api";
import { loadManifest, resolveActive } from "@/modules/Manifest";
import {
  discoverPrimitives,
  resolvePrimitiveConflicts,
  type AttributedPrimitive,
} from "@/modules/Primitives";
import { APM_MODULES_DIR } from "@/modules/Resolver";
import { cleanCompileOutputs, outputShapeFromPath, type CompileOutputShape } from "./clean.ts";
import {
  assertSafeCompileOutput,
  buildDistributedPlan,
  type DistributedPlan,
} from "./distributed.ts";
import type {
  CompileAgentsMdOptions,
  CompileAgentsMdResult,
  CompileAttributionEntry,
  CompileOutput,
} from "./types.ts";

type ResolvedCompileTarget = Pick<BapmIntegration, "id" | "compile" | "globalCompileOutput">;

/** Home-relative global output path, if the host opts into global compile. */
function globalCompileOutputOf(target: ResolvedCompileTarget): string | undefined {
  const value = target.globalCompileOutput;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isGlobalCompileTarget(target: BapmIntegration): boolean {
  return typeof target.compile === "function" && globalCompileOutputOf(target) !== undefined;
}

function supportedGlobalCompileHosts(registry: IntegrationRegistry): string[] {
  return registry
    .list()
    .filter(isGlobalCompileTarget)
    .map((target) => String(target.id));
}

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
  const manifestCwd = resolve(options.manifestCwd ?? cwd);
  const deployCwd = resolve(options.deployCwd ?? cwd);
  const scope = options.scope === "global" ? "global" : "project";
  const modulesDir = options.modulesDir ?? join(manifestCwd, APM_MODULES_DIR);

  if (scope === "global" && options.outputFile?.trim()) {
    throw new Error(
      "Compile --global does not accept --output / -o; each host owns its user-scope output path",
    );
  }

  const raw = discoverPrimitives({ cwd: manifestCwd, modulesDir });
  const { primitives } = resolvePrimitiveConflicts({ primitives: raw });
  const sorted = sortPrimitives(primitives);
  const attribution = toAttribution(sorted);

  const targets = await selectCompileTargets(options, manifestCwd, scope);
  const multi = targets.length > 1;
  if (options.distributed === true && options.outputFile?.trim()) {
    throw new Error(
      "Compile --distributed does not accept one --output / -o path; per-directory outputs derive from each target's default path",
    );
  }
  if (multi && options.outputFile?.trim()) {
    throw new Error(
      "Compile with multiple compile targets cannot use one --output path; select a single target or omit -o / --output",
    );
  }
  if (scope === "global") {
    for (const target of targets) {
      const output = globalCompileOutputOf(target);
      if (!output) {
        throw globalCompileUnsupportedError(target.id, options.integrationRegistry);
      }
      // Fail closed before any host write if an integration declares an unsafe
      // home-relative path.
      assertSafeCompileOutput(deployCwd, output);
    }
  }

  const write = options.validate !== true && options.dryRun !== true;
  const outputFileFor = (target: ResolvedCompileTarget): string | undefined =>
    scope === "global" ? globalCompileOutputOf(target) : options.outputFile;
  const compileContextFor = (target: ResolvedCompileTarget) => ({
    cwd: deployCwd,
    outputFile: outputFileFor(target),
    ...(scope === "global" ? { includeInstructions: true } : {}),
  });

  let outputs: CompileOutput[];
  let firstContent = "";

  if (options.distributed === true) {
    const distributed = await compileDistributed({
      cwd: deployCwd,
      scope,
      targets,
      plan: buildDistributedPlan(sorted, deployCwd),
      write,
    });
    firstContent = distributed.firstContent;
    outputs = distributed.outputs;
  } else if (!multi) {
    const target = targets[0]!;
    const emitted = await target.compile!(sorted, {
      ...compileContextFor(target),
      write,
    });
    firstContent = emitted.content;
    outputs = [{ targetId: target.id, path: emitted.path, wrote: emitted.wrote }];
  } else {
    // Preflight: render without writing so output paths are known before any
    // file is touched. Collisions fail closed instead of last-writer-wins.
    const previews = await Promise.all(
      targets.map(async (target) => ({
        target,
        emitted: await target.compile!(sorted, {
          ...compileContextFor(target),
          write: false,
        }),
      })),
    );
    assertNoOutputCollision(deployCwd, previews);

    if (write) {
      const written = await Promise.all(
        previews.map(async ({ target }) => {
          const durable = await target.compile!(sorted, {
            ...compileContextFor(target),
            write: true,
          });
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

  // `--clean` is orphan cleanup, mirroring APM: keep this run's planned
  // outputs, remove only stale generated files with a valid Build ID.
  const shapes =
    options.clean === true && options.validate !== true
      ? await selectedOutputShapes(targets, deployCwd, options.outputFile, scope)
      : [];
  const cleanSearchDirs =
    scope === "global"
      ? [...new Set(shapes.map((shape) => shape.dir).filter((dir) => dir.length > 0))]
      : undefined;
  const clean =
    options.clean === true && options.validate !== true
      ? cleanCompileOutputs({
          cwd: deployCwd,
          shapes,
          keep: outputs.map((output) => output.path),
          dryRun: options.dryRun === true,
          ...(cleanSearchDirs ? { searchDirs: cleanSearchDirs } : {}),
        })
      : undefined;

  return {
    ok: true,
    path: outputs[0]?.path,
    content: firstContent,
    wrote: outputs.length > 0 && outputs.every((output) => output.wrote),
    primitivesCount: sorted.length,
    attribution,
    outputs,
    ...(clean ? { clean } : {}),
  };
}

export const compileProject = compileAgentsMd;
export const runCompile = compileAgentsMd;
export const emitAgentsMd = compileAgentsMd;

type PlannedEmission = {
  dir: string;
  primitives: AttributedPrimitive[];
  outputFile: string;
};

type TargetEmissionPlan = {
  target: ResolvedCompileTarget;
  emissions: PlannedEmission[];
};

type EmissionPreview = {
  target: ResolvedCompileTarget;
  targetId: string;
  primitives: AttributedPrimitive[];
  outputFile: string;
  emitted: { path: string; content: string; wrote: boolean };
};

/**
 * Opt-in distributed emission: render root primitives once and each literal
 * `applyTo` directory through the same host-owned compiler. The host keeps its
 * default basename; only the directory changes.
 */
async function compileDistributed(args: {
  cwd: string;
  scope: "project" | "global";
  targets: ResolvedCompileTarget[];
  plan: DistributedPlan;
  write: boolean;
}): Promise<{ outputs: CompileOutput[]; firstContent: string }> {
  const targetPlans: TargetEmissionPlan[] = [];
  for (const target of args.targets) {
    targetPlans.push(await planTargetEmissions(target, args.plan, args.cwd, args.scope));
  }

  // Render without writing first so every path is known and validated before
  // any file is touched. This also covers --dry-run / --validate.
  const previews: EmissionPreview[] = [];
  for (const targetPlan of targetPlans) {
    for (const emission of targetPlan.emissions) {
      assertSafeCompileOutput(args.cwd, emission.outputFile);
      const emitted = await targetPlan.target.compile!(emission.primitives, {
        cwd: args.cwd,
        outputFile: emission.outputFile,
        write: false,
        includeInstructions: true,
      });
      previews.push({
        target: targetPlan.target,
        targetId: String(targetPlan.target.id),
        primitives: emission.primitives,
        outputFile: emission.outputFile,
        emitted,
      });
    }
  }
  assertNoDistributedCollision(args.cwd, previews);

  if (!args.write) {
    return {
      firstContent: previews[0]?.emitted.content ?? "",
      outputs: previews.map((preview) => ({
        targetId: preview.targetId,
        path: preview.emitted.path,
        wrote: false,
      })),
    };
  }

  const written: Array<{ targetId: string; path: string; wrote: boolean; content: string }> = [];
  for (const preview of previews) {
    const durable = await preview.target.compile!(preview.primitives, {
      cwd: args.cwd,
      outputFile: preview.outputFile,
      write: true,
      includeInstructions: true,
    });
    written.push({
      targetId: preview.targetId,
      path: durable.path,
      wrote: durable.wrote,
      content: durable.content,
    });
  }

  return {
    firstContent: written[0]?.content ?? "",
    outputs: written.map(({ targetId, path, wrote }) => ({ targetId, path, wrote })),
  };
}

async function planTargetEmissions(
  target: ResolvedCompileTarget,
  plan: DistributedPlan,
  cwd: string,
  scope: "project" | "global",
): Promise<TargetEmissionPlan> {
  // Probe the target's own default path with an empty primitive set. The host
  // owns the basename and any host-specific prefix (for example .github/).
  // Global hosts declare their home-relative root instead of probing the
  // project-shaped default.
  const rootPath =
    scope === "global"
      ? globalCompileOutputOf(target)!
      : (
          await target.compile!([], {
            cwd,
            write: false,
            includeInstructions: true,
          })
        ).path;
  const rootDir = dirname(rootPath);

  const emissions = plan.placements.map((placement) => ({
    dir: placement.dir,
    primitives: placement.primitives,
    outputFile:
      placement.dir === ""
        ? rootPath
        : join(rootDir === "." ? "" : rootDir, placement.dir, basename(rootPath)),
  }));

  return { target, emissions };
}

function assertNoDistributedCollision(cwd: string, previews: EmissionPreview[]): void {
  const byPath = new Map<string, Array<{ targetId: string; path: string }>>();
  for (const preview of previews) {
    const key = resolve(cwd, preview.emitted.path);
    const hosts = byPath.get(key) ?? [];
    hosts.push({ targetId: preview.targetId, path: preview.emitted.path });
    byPath.set(key, hosts);
  }

  for (const hosts of byPath.values()) {
    const ids = [...new Set(hosts.map((host) => host.targetId))];
    if (ids.length < 2) continue;
    const path = hosts[0]!.path;
    throw new Error(
      `Compile target collision: hosts ${ids.map((id) => `"${id}"`).join(", ")} all write "${path}". ` +
        "Refusing to overwrite one host's output with another; select one host per output path or exclude duplicates.",
    );
  }
}

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

/**
 * Probe each selected target's default output path (and an explicit `-o`
 * override) to derive the shapes eligible for orphan cleanup. Distributed
 * outputs keep the host's basename/prefix, so this covers their nested paths.
 */
async function selectedOutputShapes(
  targets: ResolvedCompileTarget[],
  cwd: string,
  outputFile: string | undefined,
  scope: "project" | "global",
): Promise<CompileOutputShape[]> {
  const shapes: CompileOutputShape[] = [];
  for (const target of targets) {
    const path =
      scope === "global"
        ? globalCompileOutputOf(target)!
        : (await target.compile!([], { cwd, write: false })).path;
    const shape = outputShapeFromPath(path);
    if (shape) shapes.push(shape);
  }
  const override = outputFile?.trim();
  if (override) {
    const shape = outputShapeFromPath(override);
    if (shape) shapes.push(shape);
  }
  return shapes;
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
  scope: "project" | "global",
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
        ): target is BapmIntegration & {
          compile: NonNullable<BapmIntegration["compile"]>;
        } =>
          typeof target.compile === "function" &&
          (scope !== "global" || isGlobalCompileTarget(target)),
      )
      .map((target) => ({
        id: target.id,
        compile: target.compile,
        globalCompileOutput: target.globalCompileOutput,
      }));
    if (targets.length === 0) {
      throw new Error(
        scope === "global"
          ? `Compile --global --all found no registered compile-capable targets with user-scope paths. Supported global compile hosts: ${supportedGlobalCompileHosts(registry).join(", ") || "(none registered)"}`
          : "Compile --all found no registered compile-capable targets; register host integrations first",
      );
    }
    return targets;
  }

  const forcedIds = normalizeForcedTargets(options.forcedTargets);
  if (options.forcedTarget && forcedIds.length > 0) {
    throw new Error("Compile accepts either forcedTarget or forcedTargets, not both");
  }
  if (forcedIds.length > 0) {
    return forcedIds.map((id) => resolveCompileTarget(registry, id, scope));
  }

  const single = await selectCompileTarget(
    registry,
    options.forcedTarget,
    cwd,
    scope,
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

function resolveCompileTarget(
  registry: IntegrationRegistry,
  id: string,
  scope: "project" | "global",
): ResolvedCompileTarget {
  const target = registry.get(id);
  if (!target) throw new Error(`Unknown or unregistered target: ${id}`);
  if (typeof target.compile !== "function") {
    throw new Error(`Target "${target.id}" does not support compile`);
  }
  if (scope === "global" && !isGlobalCompileTarget(target)) {
    throw globalCompileUnsupportedError(target.id, registry);
  }
  return {
    id: target.id,
    compile: target.compile,
    globalCompileOutput: target.globalCompileOutput,
  };
}

function globalCompileUnsupportedError(
  id: string,
  registry: IntegrationRegistry | undefined,
): Error {
  const supported = registry ? supportedGlobalCompileHosts(registry) : [];
  return new Error(
    `Global compile is not supported for target "${id}". Supported global compile hosts: ${supported.join(", ") || "(none registered)"}.`,
  );
}

async function selectCompileTarget(
  registry: IntegrationRegistry,
  forcedTarget: string | undefined,
  cwd: string,
  scope: "project" | "global",
  configTarget?: string,
): Promise<ResolvedCompileTarget> {
  // 1. Forced --target
  if (forcedTarget) {
    return resolveCompileTarget(registry, forcedTarget, scope);
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
    return resolveCompileTarget(registry, soleId, scope);
  }

  // 3. User config default target (before detect)
  const configured = configTarget?.trim();
  if (configured) {
    return resolveCompileTarget(registry, configured, scope);
  }

  // 4. Sole auto-detect among compile-capable registered hosts
  const detection = await detectRegisteredTargets(registry, cwd, scope);
  const candidates = detection.detectedIds
    .map((id) => registry.get(id))
    .filter((target): target is BapmIntegration => Boolean(target?.compile));
  if (candidates.length !== 1) {
    throw new Error(
      scope === "global"
        ? `Global target detection is missing or ambiguous; pass --target <id> (supported compile hosts: ${supportedGlobalCompileHosts(registry).join(", ") || "(none registered)"}) or set active in ~/.bapm/bapm.yml`
        : "Target detection is missing or ambiguous; pass --target <id> or set active in the manifest",
    );
  }
  const detected = candidates[0]!;
  if (scope === "global" && !isGlobalCompileTarget(detected)) {
    throw globalCompileUnsupportedError(detected.id, registry);
  }
  return {
    id: detected.id,
    compile: detected.compile!,
    globalCompileOutput: detected.globalCompileOutput,
  };
}

async function detectRegisteredTargets(
  registry: IntegrationRegistry,
  cwd: string,
  scope: "project" | "global" = "project",
): Promise<{ detectedIds: string[] }> {
  // A custom registry `detect(cwd)` is project-only; global detection must use
  // each target's user-scope detector.
  if (scope !== "global" && typeof registry.detect === "function") return registry.detect(cwd);

  const detectedIds: string[] = [];
  for (const target of registry.list()) {
    try {
      const detect = scope === "global" ? target.detectGlobal : target.detect;
      if (detect && (await detect({ cwd }))) detectedIds.push(target.id);
    } catch {
      // Detection errors are documented non-matches.
    }
  }
  return { detectedIds };
}
