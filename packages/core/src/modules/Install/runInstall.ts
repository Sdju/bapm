import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { BapmTarget, TargetRegistry } from "bapm-target-api";
import {
  loadManifest,
  type BapmManifest,
  type DependencyEntry,
  type ObjectDependency,
} from "@/modules/Manifest";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import {
  APM_MODULES_DIR,
  DEFAULT_PARALLEL_DOWNLOADS,
  downloadPackages,
  resolveAndLock,
  resolveDependencyGraph,
  type ResolvedNode,
} from "@/modules/Resolver";
import {
  discoverPrimitives,
  resolvePrimitiveConflicts,
  type AttributedPrimitive,
} from "@/modules/Primitives";
import { enforceFrozen } from "./frozen.ts";
import { declaredTargetIds } from "./targets.ts";
import type { InstallResult, RunInstallOptions } from "./types.ts";

/**
 * Run install: frozen gate → resolve/download → primitives → targets → lock (unless frozen).
 */
export async function runInstall(options: RunInstallOptions = {}): Promise<InstallResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const frozen = options.frozen === true;
  const updateRefs = options.updateRefs === true || options.update === true;

  if (frozen) {
    enforceFrozen({ cwd, updateRefs, update: options.update });
  }

  const { document: rootManifest } = loadManifest({ cwd });

  let lockPath: string | undefined;
  let nodes: ResolvedNode[] = [];

  const ports = {
    gitRemote: options.gitRemote,
    tagLister: options.tagLister,
    downloader: options.downloader,
  };

  if (frozen) {
    const loaded = loadLockfileOrNull({ cwd });
    const graph = await resolveDependencyGraph({
      cwd,
      updateRefs: false,
      maxDepth: options.maxDepth,
      existingLock: loaded?.document ?? null,
      ...ports,
    });
    nodes = graph.nodes;
    const packages = nodes
      .filter((n) => n.kind === "git-literal" || n.kind === "git-semver" || n.kind === "local")
      .map((n) => ({
        repoUrl: n.kind === "local" ? undefined : restoreGitUrl(n.repo_url),
        path: n.path,
        commit: n.resolved_commit,
        identity: n.identity,
        name: n.name,
      }));
    await downloadPackages({
      cwd,
      packages,
      parallelDownloads: options.parallelDownloads ?? DEFAULT_PARALLEL_DOWNLOADS,
      downloader: options.downloader,
    });
    lockPath = loaded?.sourcePath;
  } else {
    const result = await resolveAndLock({
      cwd,
      updateRefs,
      parallelDownloads: options.parallelDownloads,
      maxDepth: options.maxDepth,
      verbose: options.verbose,
      ...ports,
    });
    lockPath = result.lockPath;
    nodes = result.nodes;
  }

  const declarationOrder =
    nodes.length > 0
      ? uniqueNames(nodes.filter((n) => n.depth === 1).map((n) => n.name))
      : extractDeclarationOrder(rootManifest);

  const raw = discoverPrimitives({
    cwd,
    modulesDir: join(cwd, APM_MODULES_DIR),
    declarationOrder,
  });
  const resolved = resolvePrimitiveConflicts({
    primitives: raw,
    declarationOrder,
  });

  const registry = (options.targetRegistry ?? options.registry) as TargetRegistry | undefined;
  const activeTargets = await resolveActiveTargets({
    cwd,
    rootManifest,
    registry,
    override: options.activeTargets,
  });

  if (registry && activeTargets.length > 0) {
    const packageTargets = collectPackageDeclaredTargets(nodes, raw);
    for (const targetId of activeTargets) {
      const target = findTarget(registry, targetId);
      if (!target) continue;
      const detected = await target.detect({ cwd });
      if (!detected) continue;

      const filtered = filterByIntersection(
        resolved.primitives,
        targetId,
        packageTargets,
        rootManifest,
      );
      await target.materialize(filtered, {
        cwd,
        targetId,
        deployRoots: [...target.deployRoots],
      });
    }
  }

  return {
    ok: true,
    lockPath,
    modulesDir: join(cwd, APM_MODULES_DIR),
    activeTargets,
    primitivesCount: resolved.primitives.length,
    diagnostics: resolved.diagnostics,
  };
}

/** Alias preferred by design docs. */
export const installProject = runInstall;

async function resolveActiveTargets(args: {
  cwd: string;
  rootManifest: BapmManifest;
  registry?: TargetRegistry;
  override?: string[];
}): Promise<string[]> {
  if (args.override && args.override.length > 0) return [...args.override];

  const declared = declaredTargetIds(args.rootManifest);
  if (declared.length > 0) return declared;

  if (!args.registry) return [];

  const active: string[] = [];
  for (const t of listRegistry(args.registry)) {
    try {
      if (await t.detect({ cwd: args.cwd })) active.push(String(t.id));
    } catch {
      /* ignore detect errors */
    }
  }
  return active;
}

function listRegistry(registry: TargetRegistry): BapmTarget[] {
  if (typeof registry.list === "function") return registry.list();
  if (typeof registry.getAll === "function") return registry.getAll();
  return [];
}

function findTarget(registry: TargetRegistry, id: string): BapmTarget | undefined {
  if (typeof registry.get === "function") {
    const t = registry.get(id);
    if (t) return t;
  }
  return listRegistry(registry).find((t) => String(t.id) === id);
}

function collectPackageDeclaredTargets(
  nodes: ResolvedNode[],
  primitives: AttributedPrimitive[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const n of nodes) {
    const root = n.packageRoot;
    if (!root || !existsSync(root)) continue;
    try {
      const { document } = loadManifest({ cwd: root });
      map.set(n.name, declaredTargetIds(document));
    } catch {
      map.set(n.name, []);
    }
  }

  for (const p of primitives) {
    if (!p.packageName || map.has(p.packageName)) continue;
    if (p.source === "local") continue;
    const pkgRoot = findManifestRoot(p.path);
    if (!pkgRoot) {
      map.set(p.packageName, []);
      continue;
    }
    try {
      const { document } = loadManifest({ cwd: pkgRoot });
      map.set(p.packageName, declaredTargetIds(document));
    } catch {
      map.set(p.packageName, []);
    }
  }

  return map;
}

function findManifestRoot(filePath: string): string | undefined {
  let dir = resolve(filePath);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "apm.yml")) || existsSync(join(dir, "bapm.yml"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function filterByIntersection(
  primitives: AttributedPrimitive[],
  activeTargetId: string,
  packageTargets: Map<string, string[]>,
  rootManifest: BapmManifest,
): AttributedPrimitive[] {
  const rootDeclared = declaredTargetIds(rootManifest);
  const consumerAuth = new Set(rootDeclared.length > 0 ? rootDeclared : [activeTargetId]);
  if (!consumerAuth.has(activeTargetId)) return [];

  return primitives.filter((p) => {
    if (p.source === "local") {
      return consumerAuth.has(activeTargetId);
    }
    const pkgName = p.packageName ?? p.source.slice("dependency:".length);
    const declared = packageTargets.get(pkgName);
    if (!declared || declared.length === 0) {
      return true;
    }
    return declared.includes(activeTargetId);
  });
}

function extractDeclarationOrder(manifest: BapmManifest): string[] {
  const apm = manifest.dependencies?.apm;
  if (!Array.isArray(apm)) return [];
  const names: string[] = [];
  for (const entry of apm) {
    const n = entryNameHint(entry);
    if (n) names.push(n);
  }
  return names;
}

function entryNameHint(entry: DependencyEntry): string | undefined {
  if (typeof entry === "string") return entry.split("/").pop();
  const o = entry as ObjectDependency;
  if (o.alias && typeof o.alias === "string") return o.alias;
  if (o.path) {
    return o.path.replace(/^\.\//, "").split("/").filter(Boolean).pop();
  }
  if (o.git) {
    return o.git
      .replace(/\.git$/i, "")
      .split("/")
      .pop();
  }
  if (o.id) return o.id;
  return undefined;
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function restoreGitUrl(repoUrl: string | undefined): string | undefined {
  if (!repoUrl) return undefined;
  if (repoUrl.startsWith("local:")) return undefined;
  if (repoUrl.includes("://")) return repoUrl;
  return `https://${repoUrl}`;
}
