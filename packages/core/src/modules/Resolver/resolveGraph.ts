import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadManifest } from "@/modules/Manifest";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import type { DependencyEntry, ObjectDependency } from "@/modules/Manifest";
import { resolveMarketplacePlugin, type MarketplaceProvenance } from "@/modules/Marketplace";
import {
  createRegistryClient,
  downloadUrl,
  experimentalRegistriesRemediation,
  isExperimentalRegistriesEnabled,
  modulesRegistryDest,
  parsePackageId,
  pickRegistryVersion,
  registryRepoUrl,
  resolveRegistryBaseUrl,
  RegistryError,
} from "@/modules/Registry";
import { classifyDependencyRef } from "./classify.ts";
import { MAX_RESOLVE_DEPTH } from "./constants.ts";
import {
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
  modulesCacheDest,
} from "./defaults.ts";
import { ResolverError } from "./errors.ts";
import { normalizeRepoIdentity, toLockRepoUrl } from "./identity.ts";
import { resolveLocalPath } from "./localPath.ts";
import {
  pickHighestInIntersection,
  pickHighestSatisfyingTag,
  pickTightestRange,
} from "./semver.ts";
import type {
  ClassifiedDependency,
  DownloadArgs,
  Downloader,
  GitRemote,
  MarketplaceLockProvenance,
  ResolveDependencyGraphOptions,
  ResolveGraphResult,
  ResolvedNode,
  TagLister,
} from "./types.ts";

type QueueItem = {
  entry: DependencyEntry;
  depth: number;
  /** Chain segments like `root` or `via-a@^1.0.0` for diagnostics / resolved_by. */
  chain: string[];
  /** Ancestor package identities on the path from root (cycle detection for BFS). */
  ancestorIdentities: string[];
  /** Absolute path of the declaring package (for resolving relative local paths). */
  fromDir: string;
  parentName: string;
  /** When updateRefs: whether this edge should ignore warm pins (rs-012 scope). */
  shouldUpdate: boolean;
  /** Marketplace provenance to attach once the concrete edge materializes. */
  marketplaceProvenance?: MarketplaceLockProvenance;
};

type EdgeRecord = {
  identity: string;
  kind: ClassifiedDependency["kind"];
  classified: ClassifiedDependency;
  depth: number;
  chain: string[];
  constraint?: string;
  resolved_commit?: string;
  resolved_tag?: string;
  resolved_at?: string;
  name: string;
  path?: string;
  packageRoot?: string;
  repo_url?: string;
  source?: string;
  resolved_url?: string;
  resolved_hash?: string;
  version?: string;
  registry_base_url?: string;
  registry_owner?: string;
  registry_repo?: string;
  marketplaceProvenance?: MarketplaceLockProvenance;
};

type WarmPin = {
  resolved_commit?: string;
  constraint?: string;
  resolved_tag?: string;
  resolved_at?: string;
  repo_url: string;
  name?: string;
  source?: string;
  resolved_url?: string;
  resolved_hash?: string;
  version?: string;
};

function normalizeScope(scope: string[] | undefined): Set<string> {
  if (!scope || scope.length === 0) return new Set();
  return new Set(scope.map((s) => s.trim()).filter(Boolean));
}

function entryMatchesScope(
  entry: DependencyEntry,
  scope: Set<string>,
  warmByIdentity: Map<string, WarmPin>,
): boolean {
  if (scope.size === 0) return true;
  const n = normalizeEntry(entry);
  if (typeof n === "string") {
    return [...scope].some((s) => n === s || n.includes(s) || s.includes(n));
  }
  const obj = n as ObjectDependency;
  if (obj.alias && scope.has(String(obj.alias))) return true;
  if (obj.git) {
    const identity = normalizeRepoIdentity(obj.git);
    const base = identity.split("/").pop() ?? identity;
    if (scope.has(base) || scope.has(identity)) return true;
    const warm = warmByIdentity.get(identity);
    if (warm?.name && scope.has(warm.name)) return true;
    return [...scope].some((s) => identity.includes(s) || base.includes(s));
  }
  if (obj.path) {
    const pathKey = String(obj.path).replace(/^\.\//, "").replace(/\/+$/, "");
    const base = pathKey.split("/").filter(Boolean).pop() ?? pathKey;
    if (scope.has(base) || scope.has(pathKey)) return true;
    return [...scope].some((s) => pathKey.includes(s) || base.includes(s));
  }
  if (obj.id && scope.has(String(obj.id))) return true;
  return false;
}

/**
 * BFS transitive resolve with OpenAPM intersection-pick diamonds (not APM first-wins).
 */
export async function resolveDependencyGraph(
  options: ResolveDependencyGraphOptions = {},
): Promise<ResolveGraphResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const maxDepth = options.maxDepth ?? MAX_RESOLVE_DEPTH;
  const updateRefs = options.updateRefs === true;
  const scopeSet = normalizeScope(options.scope ?? options.updatePackageNames);

  const gitRemote: GitRemote = options.gitRemote ?? createDefaultGitRemote();
  const tagLister: TagLister = options.tagLister ?? createDefaultTagLister();
  const downloader: Downloader = options.downloader ?? createDefaultDownloader();
  const skipDownload = options.skipDownload === true || options.planOnly === true;
  const experimentalRegistries = isExperimentalRegistriesEnabled({
    experimentalRegistries: options.experimentalRegistries,
  });
  const marketplaceConfigDir = options.marketplaceConfigDir ?? options.configDir;

  const { document: manifest } = loadManifest({ cwd });
  const rootName = manifest.name;

  const conflictResolution = (manifest.dependencies as Record<string, unknown> | undefined)
    ?.conflict_resolution;
  if (conflictResolution === "nest") {
    throw new ResolverError(
      "RESOLVE_NEST_REFUSED",
      "dependencies.conflict_resolution: nest is reserved for a later OpenAPM version (v0.2); refuse nest",
    );
  }

  const warmLock =
    options.existingLock !== undefined
      ? options.existingLock
      : (loadLockfileOrNull({ cwd })?.document ?? null);
  const warmByIdentity = indexWarmPins(warmLock);

  const queue: QueueItem[] = [];
  const visitOrder: string[] = [];
  const edgesByIdentity = new Map<string, EdgeRecord[]>();
  /** Expand keys whose children have already been enqueued (avoid re-expand). */
  const expanded = new Set<string>();
  /** Local copies begin only after every graph edge has passed validation. */
  const localMaterializations: DownloadArgs[] = [];

  const rootDeps = [
    ...listApmDeps(manifest.dependencies),
    ...listApmDeps(manifest.devDependencies),
  ];
  for (const entry of rootDeps) {
    const shouldUpdate =
      updateRefs && (scopeSet.size === 0 || entryMatchesScope(entry, scopeSet, warmByIdentity));
    queue.push({
      entry,
      depth: 1,
      chain: [rootName],
      ancestorIdentities: [],
      fromDir: cwd,
      parentName: rootName,
      shouldUpdate,
    });
  }

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.depth > maxDepth) {
      const chainText = [...item.chain, summarizeEntry(item.entry)].join("->");
      throw new ResolverError(
        "RESOLVE_DEPTH_EXCEEDED",
        `Resolve depth exceeded max ${maxDepth}; chain: ${chainText}`,
        { details: { chain: chainText, maxDepth } },
      );
    }

    const classified = classifyDependencyRef(normalizeEntry(item.entry));

    if (classified.kind === "marketplace") {
      const concrete = await resolveMarketplaceEdge(item, classified, {
        marketplaceConfigDir,
      });
      queue.unshift(concrete);
      continue;
    }

    if (classified.kind === "registry") {
      if (!experimentalRegistries) {
        throw new ResolverError(
          "RESOLVE_REGISTRY_DEFERRED",
          `Registry dependency resolve is experimental/deferred until enabled (id=${classified.id ?? "?"}). ${experimentalRegistriesRemediation()} — not falling back to git`,
        );
      }
      await resolveRegistry(item, classified, {
        cwd,
        manifestRegistries: manifest.registries,
        registryBaseUrl: options.registryBaseUrl,
        warmByIdentity,
        edgesByIdentity,
        visitOrder,
        updateRefs,
        shouldUpdate: item.shouldUpdate,
      });
      continue;
    }

    if (classified.kind === "local") {
      await resolveLocal(item, classified, {
        cwd,
        downloader,
        skipDownload,
        edgesByIdentity,
        visitOrder,
        queue,
        expanded,
        localMaterializations,
      });
      continue;
    }

    // git-semver / git-literal
    await resolveGit(item, classified, {
      cwd,
      gitRemote,
      tagLister,
      downloader,
      skipDownload,
      updateRefs,
      warmByIdentity,
      edgesByIdentity,
      visitOrder,
      queue,
      expanded,
      shouldUpdate: item.shouldUpdate,
    });
  }

  for (const materialization of localMaterializations) {
    await downloader.download(materialization);
  }

  // Intersection-pick per identity
  const nodes = await applyIntersectionPick(edgesByIdentity, tagLister);
  const dependencies = nodes.map(nodeToLockRow);
  const lockfile = { dependencies };

  return { nodes, visitOrder, lockfile, document: lockfile };
}

async function resolveMarketplaceEdge(
  item: QueueItem,
  classified: ClassifiedDependency,
  ctx: { marketplaceConfigDir?: string },
): Promise<QueueItem> {
  const marketplaceName = classified.marketplaceName;
  const pluginName = classified.pluginName;
  if (!marketplaceName || !pluginName) {
    throw new ResolverError(
      "RESOLVE_FAILED",
      `Marketplace dependency missing name/marketplace (marketplace=${marketplaceName ?? "?"}, name=${pluginName ?? "?"})`,
    );
  }

  let resolution;
  try {
    resolution = await resolveMarketplacePlugin(
      pluginName,
      marketplaceName,
      classified.versionSpec ?? null,
      {
        configDir: ctx.marketplaceConfigDir,
        marketplaceConfigDir: ctx.marketplaceConfigDir,
      },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new ResolverError("RESOLVE_FAILED", message, { cause });
  }

  const provenance: MarketplaceProvenance = resolution.provenance(marketplaceName, pluginName);
  const dep = resolution.dependency;
  const entry: DependencyEntry =
    typeof dep === "string"
      ? dep
      : (("path" in dep ? { path: dep.path } : { git: dep.git, ref: dep.ref }) as ObjectDependency);

  return {
    ...item,
    entry,
    marketplaceProvenance: provenance,
  };
}

function nodeToLockRow(n: ResolvedNode): Record<string, unknown> {
  const row: Record<string, unknown> = {
    name: n.name,
    repo_url: n.repo_url ?? n.identity,
  };
  if (n.kind === "local") row.source = "local";
  else if (n.kind === "registry") row.source = "registry";
  else row.source = n.source ?? "git";
  if (n.resolved_commit) row.resolved_commit = n.resolved_commit;
  if (n.version) row.version = n.version;
  if (n.path) row.path = n.path;
  if (n.constraint) row.constraint = n.constraint;
  if (n.resolved_tag) row.resolved_tag = n.resolved_tag;
  if (n.resolved_url) row.resolved_url = n.resolved_url;
  if (n.resolved_hash) row.resolved_hash = n.resolved_hash;
  if (n.discovered_via) row.discovered_via = n.discovered_via;
  if (n.marketplace_plugin_name) row.marketplace_plugin_name = n.marketplace_plugin_name;
  if (n.source_url) row.source_url = n.source_url;
  if (n.source_digest) row.source_digest = n.source_digest;
  return row;
}

function listApmDeps(
  deps: { apm?: DependencyEntry[]; [k: string]: unknown } | undefined,
): DependencyEntry[] {
  if (!deps || !Array.isArray(deps.apm)) return [];
  return deps.apm;
}

function normalizeEntry(entry: DependencyEntry): unknown {
  if (typeof entry === "string") return entry;
  if (
    entry &&
    typeof entry === "object" &&
    "spec" in entry &&
    !("git" in entry) &&
    !("path" in entry)
  ) {
    return (entry as { spec: string }).spec;
  }
  return entry;
}

function summarizeEntry(entry: DependencyEntry): string {
  const n = normalizeEntry(entry);
  if (typeof n === "string") return n;
  const o = n as ObjectDependency;
  if (o.git) return `${toLockRepoUrl(o.git)}${o.ref ? `@${o.ref}` : ""}`;
  if (o.path) return o.path;
  if (o.id) return o.id;
  return "dep";
}

function indexWarmPins(
  lock: { dependencies?: Array<Record<string, unknown>> } | null,
): Map<string, WarmPin> {
  const map = new Map<string, WarmPin>();
  if (!lock?.dependencies) return map;
  for (const d of lock.dependencies) {
    const repoRaw = d.repo_url;
    const repo = typeof repoRaw === "string" ? repoRaw : "";
    if (!repo) continue;
    const identity = repo.startsWith("local:")
      ? repo
      : normalizeRepoIdentity(repo.includes("://") ? repo : `https://${repo}`);
    const pin: WarmPin = {
      repo_url: repo,
      resolved_commit: typeof d.resolved_commit === "string" ? d.resolved_commit : undefined,
      constraint: typeof d.constraint === "string" ? d.constraint : undefined,
      resolved_tag: typeof d.resolved_tag === "string" ? d.resolved_tag : undefined,
      resolved_at: typeof d.resolved_at === "string" ? d.resolved_at : undefined,
      name: typeof d.name === "string" ? d.name : undefined,
      source: typeof d.source === "string" ? d.source : undefined,
      resolved_url: typeof d.resolved_url === "string" ? d.resolved_url : undefined,
      resolved_hash: typeof d.resolved_hash === "string" ? d.resolved_hash : undefined,
      version: typeof d.version === "string" ? d.version : undefined,
    };
    map.set(identity, pin);
    // Registry packages also index by package id (owner/repo) for mirror replay
    if (pin.source === "registry" && pin.name) {
      map.set(`registry:${pin.name}`, pin);
      map.set(pin.name, pin);
    }
  }
  return map;
}

async function resolveRegistry(
  item: QueueItem,
  classified: ClassifiedDependency,
  ctx: {
    cwd: string;
    manifestRegistries?: Record<string, import("@/modules/Manifest").RegistryEntry | string>;
    registryBaseUrl?: string;
    warmByIdentity: Map<string, WarmPin>;
    edgesByIdentity: Map<string, EdgeRecord[]>;
    visitOrder: string[];
    updateRefs: boolean;
    shouldUpdate: boolean;
  },
): Promise<void> {
  const packageId = classified.id;
  if (!packageId) {
    throw new ResolverError("RESOLVE_FAILED", "Registry dependency missing id:");
  }

  const { owner, repo } = parsePackageId(packageId);
  const rawObj = classified.raw as ObjectDependency;
  const versionConstraint =
    (typeof rawObj.version === "string" ? rawObj.version : undefined) ??
    (typeof rawObj.ref === "string" ? rawObj.ref : undefined) ??
    "*";

  let baseUrl: string;
  let registryName: string | undefined;
  try {
    const resolved = resolveRegistryBaseUrl({
      registries: ctx.manifestRegistries,
      registryName: classified.registry,
      registryBaseUrl: ctx.registryBaseUrl,
    });
    baseUrl = resolved.baseUrl;
    registryName = resolved.registryName;
  } catch (cause) {
    if (cause instanceof RegistryError) {
      throw new ResolverError("RESOLVE_FAILED", cause.message, { cause });
    }
    throw cause;
  }

  const lockUrl = registryRepoUrl(baseUrl, packageId);
  const identity = lockUrl;
  const warm =
    ctx.warmByIdentity.get(`registry:${packageId}`) ??
    ctx.warmByIdentity.get(packageId) ??
    ctx.warmByIdentity.get(identity);

  const reResolve = ctx.updateRefs && ctx.shouldUpdate;
  let version: string;
  let digest: string;
  let resolved_url: string;

  const warmOk =
    !reResolve &&
    warm?.source === "registry" &&
    typeof warm.resolved_hash === "string" &&
    typeof warm.version === "string" &&
    typeof warm.resolved_url === "string";

  if (warmOk) {
    version = warm!.version!;
    digest = warm!.resolved_hash!;
    resolved_url = warm!.resolved_url!;
  } else {
    try {
      const client = createRegistryClient({
        baseUrl,
        registryName,
      });
      const listed = await client.listVersions(owner, repo);
      const picked = pickRegistryVersion(listed, versionConstraint);
      version = picked.version;
      digest = picked.digest;
      resolved_url = downloadUrl(baseUrl, owner, repo, version);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : typeof cause === "object" && cause !== null && "message" in cause
            ? String((cause as { message: unknown }).message)
            : String(cause);
      throw new ResolverError(
        "RESOLVE_FAILED",
        `Registry fetch failed for ${packageId} (no git fallback): ${message}`,
        { cause },
      );
    }
  }

  const dest = modulesRegistryDest(ctx.cwd, packageId, version);
  const chain = [...item.chain, `${packageId}@${version}`];

  const record: EdgeRecord = {
    identity,
    kind: "registry",
    classified,
    depth: item.depth,
    chain,
    constraint: versionConstraint,
    name: packageId,
    packageRoot: dest,
    repo_url: lockUrl,
    source: "registry",
    resolved_url,
    resolved_hash: digest,
    version,
    registry_base_url: baseUrl,
    registry_owner: owner,
    registry_repo: repo,
  };
  pushEdge(ctx.edgesByIdentity, record);

  if (item.depth === 1) {
    ctx.visitOrder.push(packageId);
  }
  // Registry packages do not expand transitive deps in M10 MVP (flat zip may lack nested graph).
}

function resolvedRefForEdge(e: EdgeRecord): string | undefined {
  if (e.kind === "git-semver") {
    return e.resolved_tag;
  }
  if (e.kind === "git-literal") {
    return e.classified.ref ?? "HEAD";
  }
  return undefined;
}

function edgeToNode(e: EdgeRecord): ResolvedNode {
  return {
    name: e.name,
    identity: e.identity,
    kind: e.kind,
    depth: e.depth,
    resolved_by: e.chain.join("->"),
    repo_url: e.repo_url,
    path: e.path,
    resolved_commit: e.resolved_commit,
    resolved_ref: resolvedRefForEdge(e),
    constraint: e.constraint,
    resolved_tag: e.resolved_tag,
    resolved_at: e.resolved_at,
    packageRoot: e.packageRoot,
    version: e.version,
    source: e.source,
    resolved_url: e.resolved_url,
    resolved_hash: e.resolved_hash,
    registry_base_url: e.registry_base_url,
    registry_owner: e.registry_owner,
    registry_repo: e.registry_repo,
    ...(e.marketplaceProvenance ?? {}),
  };
}

async function resolveLocal(
  item: QueueItem,
  classified: ClassifiedDependency,
  ctx: {
    cwd: string;
    downloader: Downloader;
    skipDownload?: boolean;
    edgesByIdentity: Map<string, EdgeRecord[]>;
    visitOrder: string[];
    queue: QueueItem[];
    expanded: Set<string>;
    localMaterializations: DownloadArgs[];
  },
): Promise<void> {
  const abs = resolveLocalPath({
    originalPath: classified.path!,
    fromDir: item.fromDir,
    projectRoot: ctx.cwd,
  });
  if (!existsSync(abs)) {
    throw new ResolverError("RESOLVE_FAILED", `Local dependency path not found: ${abs}`);
  }

  let childManifest;
  try {
    childManifest = loadManifest({ cwd: abs });
  } catch (cause) {
    throw new ResolverError("RESOLVE_FAILED", `Failed to load local package manifest at ${abs}`, {
      cause,
    });
  }

  const name = childManifest.document.name;
  const identity = `local:${normalizeLocalIdentity(abs, ctx.cwd)}`;
  const chainSeg = name;
  const chain = [...item.chain, chainSeg];
  const resolved_by = chain.join("->");

  if (item.ancestorIdentities.includes(identity)) {
    throw new ResolverError(
      "RESOLVE_CYCLE",
      `Circular dependency / cycle detected: ${resolved_by}->${name}`,
    );
  }

  // Read local source in place while validating the full graph; only materialize
  // after no queued edge has been rejected.
  const dest = modulesCacheDest(ctx.cwd, identity.replace(/^local:/, "local_"));
  if (!ctx.skipDownload) {
    ctx.localMaterializations.push({ path: abs, dest, identity });
  }

  const record: EdgeRecord = {
    identity,
    kind: "local",
    classified,
    depth: item.depth,
    chain,
    name,
    path: abs,
    packageRoot: !ctx.skipDownload ? dest : abs,
    repo_url: identity,
    marketplaceProvenance: item.marketplaceProvenance,
  };
  pushEdge(ctx.edgesByIdentity, record);

  if (item.depth === 1) {
    ctx.visitOrder.push(name);
  }

  if (ctx.expanded.has(identity)) return;
  ctx.expanded.add(identity);
  const nextAncestors = [...item.ancestorIdentities, identity];
  for (const child of listApmDeps(childManifest.document.dependencies)) {
    ctx.queue.push({
      entry: child,
      depth: item.depth + 1,
      chain,
      ancestorIdentities: nextAncestors,
      fromDir: abs,
      parentName: name,
      shouldUpdate: item.shouldUpdate,
    });
  }
}

async function resolveGit(
  item: QueueItem,
  classified: ClassifiedDependency,
  ctx: {
    cwd: string;
    gitRemote: GitRemote;
    tagLister: TagLister;
    downloader: Downloader;
    skipDownload?: boolean;
    updateRefs: boolean;
    warmByIdentity: Map<string, WarmPin>;
    edgesByIdentity: Map<string, EdgeRecord[]>;
    visitOrder: string[];
    queue: QueueItem[];
    expanded: Set<string>;
    shouldUpdate: boolean;
  },
): Promise<void> {
  const gitUrl = classified.git!;
  const identity = normalizeRepoIdentity(gitUrl);
  const lockUrl = toLockRepoUrl(gitUrl);
  const warm = ctx.warmByIdentity.get(identity);
  const reResolve = ctx.updateRefs && ctx.shouldUpdate;

  let resolved_commit: string | undefined;
  let resolved_tag: string | undefined;
  let resolved_at: string | undefined;
  let constraint: string | undefined;
  let nameHint = identity.split("/").pop() ?? identity;

  if (item.ancestorIdentities.includes(identity)) {
    throw new ResolverError(
      "RESOLVE_CYCLE",
      `Circular dependency / cycle detected involving ${lockUrl}`,
    );
  }

  if (classified.kind === "git-semver") {
    constraint = classified.ref!;
    const warmOk =
      !reResolve &&
      warm?.resolved_commit &&
      warm.constraint !== undefined &&
      warm.constraint === constraint;

    if (warmOk) {
      resolved_commit = warm!.resolved_commit;
      resolved_tag = warm!.resolved_tag;
      resolved_at = warm!.resolved_at ?? warm!.resolved_tag;
    } else {
      const tags = await ctx.tagLister.listTags(gitUrl);
      const tagNames = tags.map((t) => t.tag);
      const picked = pickHighestSatisfyingTag(tagNames, constraint, {
        includePrerelease: classified.prerelease === true,
      });
      if (!picked) {
        throw new ResolverError(
          "RESOLVE_NO_MATCHING_TAG",
          `No matching tag / unsatisfiable semver range ${constraint} on ${lockUrl}`,
        );
      }
      const hit = tags.find((t) => t.tag === picked)!;
      resolved_tag = picked;
      resolved_commit = hit.commit;
      resolved_at = picked;
    }
  } else {
    // git-literal
    const ref = classified.ref ?? "HEAD";
    const warmOk =
      !reResolve && Boolean(warm?.resolved_commit) && warmConstraintMatchesLiteral(warm, ref);

    if (warmOk) {
      resolved_commit = warm!.resolved_commit;
    } else {
      resolved_commit = await ctx.gitRemote.resolveRef(gitUrl, ref);
    }
  }

  // Download to read child manifest (needed for transitive discovery).
  // When skipDownload and warm cache exists, reuse it; otherwise still download
  // for cold git trees (residual pl-002 gap vs pure plan-only).
  const dest = modulesCacheDest(ctx.cwd, identity, resolved_commit);
  const canReuseWarm = ctx.skipDownload === true && existsSync(dest);
  if (!canReuseWarm) {
    await ctx.downloader.download({
      repoUrl: gitUrl,
      commit: resolved_commit,
      dest,
      identity,
    });
  }

  let childName = warm?.name ?? nameHint;
  let childDeps: DependencyEntry[] = [];
  try {
    const child = loadManifest({ cwd: dest });
    childName = child.document.name || childName;
    childDeps = listApmDeps(child.document.dependencies);
  } catch {
    // Fake downloads may leave a minimal manifest — already written by fake port
  }

  const finalChainSeg = constraint !== undefined ? `${childName}@${constraint}` : childName;
  const finalChain = [...item.chain, finalChainSeg];

  const record: EdgeRecord = {
    identity,
    kind: classified.kind,
    classified,
    depth: item.depth,
    chain: finalChain,
    constraint,
    resolved_commit,
    resolved_tag,
    resolved_at,
    name: childName,
    packageRoot: dest,
    repo_url: lockUrl,
    marketplaceProvenance: item.marketplaceProvenance,
  };
  pushEdge(ctx.edgesByIdentity, record);

  if (item.depth === 1) {
    ctx.visitOrder.push(childName);
  }

  // Explore all edges; expand children once per (identity, constraint).
  const expandKey = `${identity}::${constraint ?? classified.ref ?? ""}`;
  if (ctx.expanded.has(expandKey)) return;
  ctx.expanded.add(expandKey);

  const nextAncestors = [...item.ancestorIdentities, identity];
  for (const child of childDeps) {
    ctx.queue.push({
      entry: child,
      depth: item.depth + 1,
      chain: finalChain,
      ancestorIdentities: nextAncestors,
      fromDir: dest,
      parentName: childName,
      shouldUpdate: ctx.shouldUpdate,
    });
  }
}

function warmConstraintMatchesLiteral(warm: WarmPin | undefined, ref: string): boolean {
  if (!warm?.resolved_commit) return false;
  // If lock has a constraint, this was git-semver — not literal warm
  if (warm.constraint !== undefined && warm.constraint !== "") {
    // Drift check for semver handled in git-semver branch
    return false;
  }
  // Warm replay for literal: reuse without network when pin present (rs-015)
  void ref;
  return true;
}

function pushEdge(map: Map<string, EdgeRecord[]>, edge: EdgeRecord): void {
  const list = map.get(edge.identity) ?? [];
  list.push(edge);
  map.set(edge.identity, list);
}

function normalizeLocalIdentity(abs: string, cwd: string): string {
  const rel = abs.startsWith(cwd) ? abs.slice(cwd.length).replace(/^\//, "") : abs;
  return rel.replace(/\\/g, "/");
}

async function applyIntersectionPick(
  edgesByIdentity: Map<string, EdgeRecord[]>,
  tagLister: TagLister,
): Promise<ResolvedNode[]> {
  const nodes: ResolvedNode[] = [];

  for (const [identity, edges] of edgesByIdentity) {
    if (edges.length === 0) continue;

    const semverEdges = edges.filter((e) => e.kind === "git-semver" && e.constraint);
    const otherEdges = edges.filter((e) => !(e.kind === "git-semver" && e.constraint));

    if (semverEdges.length >= 2) {
      const constraints = [...new Set(semverEdges.map((e) => e.constraint!))];
      if (constraints.length >= 2) {
        // Need tags to pick intersection winner
        const gitUrl = semverEdges[0]!.classified.git!;
        const tags = await tagLister.listTags(gitUrl);
        const tagNames = tags.map((t) => t.tag);
        const winnerTag = pickHighestInIntersection(tagNames, constraints);
        if (!winnerTag) {
          const chains = semverEdges.map((e) => formatChainDiag(e)).join(" and ");
          throw new ResolverError(
            "RESOLVE_EMPTY_INTERSECTION",
            `Empty intersection / cannot resolve conflicting constraints for ${identity}: ${chains}`,
            {
              details: {
                identity,
                constraints,
                chains: semverEdges.map((e) => e.chain.join("->")),
              },
            },
          );
        }

        const hit = tags.find((t) => t.tag === winnerTag)!;
        const tightest = pickTightestRange(constraints);
        const tightEdge = semverEdges.find((e) => e.constraint === tightest) ?? semverEdges[0]!;
        // Prefer deepest matching edge for depth; keep tightest chain for resolved_by
        const minDepth = Math.min(...semverEdges.map((e) => e.depth));

        nodes.push({
          name: tightEdge.name,
          identity,
          kind: "git-semver",
          depth: minDepth,
          resolved_by: tightEdge.chain.join("->"),
          repo_url: tightEdge.repo_url,
          resolved_commit: hit.commit,
          resolved_ref: winnerTag,
          constraint: tightest,
          resolved_tag: winnerTag,
          resolved_at: winnerTag,
          version: winnerTag.replace(/^v/, ""),
          packageRoot: tightEdge.packageRoot,
        });
        continue;
      }
    }

    // Single constraint or non-semver: pick shallowest edge (first-seen BFS)
    const winner = [...edges].sort(
      (a, b) => a.depth - b.depth || a.chain.join().localeCompare(b.chain.join()),
    )[0]!;

    // If multiple semver edges share same constraint, still one node
    if (
      semverEdges.length >= 1 &&
      otherEdges.length === 0 &&
      new Set(semverEdges.map((e) => e.constraint)).size === 1
    ) {
      const e = [...semverEdges].sort((a, b) => a.depth - b.depth)[0]!;
      nodes.push(edgeToNode(e));
      continue;
    }

    nodes.push(edgeToNode(winner));
  }

  // Stable-ish order by depth then name
  nodes.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
  return nodes;
}

function formatChainDiag(e: EdgeRecord): string {
  // owner/repo@constraint segments joined by ->
  const parts = e.chain.map((seg, i) => {
    if (i === 0) return seg;
    return seg;
  });
  // Ensure last segment has @constraint
  if (e.constraint && !parts[parts.length - 1]!.includes("@")) {
    parts[parts.length - 1] = `${e.name}@${e.constraint}`;
  }
  return parts.join("->");
}
