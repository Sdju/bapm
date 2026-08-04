import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { loadManifest } from "@/modules/Manifest";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import type { DependencyEntry, ObjectDependency } from "@/modules/Manifest";
import { classifyDependencyRef } from "./classify.ts";
import { MAX_RESOLVE_DEPTH } from "./constants.ts";
import {
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
  ensureModulesRoot,
  modulesCacheDest,
} from "./defaults.ts";
import { ResolverError } from "./errors.ts";
import { normalizeRepoIdentity, toLockRepoUrl } from "./identity.ts";
import {
  pickHighestInIntersection,
  pickHighestSatisfyingTag,
  pickTightestRange,
} from "./semver.ts";
import type {
  ClassifiedDependency,
  Downloader,
  GitRemote,
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
};

type WarmPin = {
  resolved_commit?: string;
  constraint?: string;
  resolved_tag?: string;
  resolved_at?: string;
  repo_url: string;
};

/**
 * BFS transitive resolve with OpenAPM intersection-pick diamonds (not APM first-wins).
 */
export async function resolveDependencyGraph(
  options: ResolveDependencyGraphOptions = {},
): Promise<ResolveGraphResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const maxDepth = options.maxDepth ?? MAX_RESOLVE_DEPTH;
  const updateRefs = options.updateRefs === true;

  const gitRemote: GitRemote = options.gitRemote ?? createDefaultGitRemote();
  const tagLister: TagLister = options.tagLister ?? createDefaultTagLister();
  const downloader: Downloader = options.downloader ?? createDefaultDownloader();

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

  ensureModulesRoot(cwd);

  const queue: QueueItem[] = [];
  const visitOrder: string[] = [];
  const edgesByIdentity = new Map<string, EdgeRecord[]>();
  /** Expand keys whose children have already been enqueued (avoid re-expand). */
  const expanded = new Set<string>();

  const rootDeps = listApmDeps(manifest.dependencies);
  for (const entry of rootDeps) {
    queue.push({
      entry,
      depth: 1,
      chain: [rootName],
      ancestorIdentities: [],
      fromDir: cwd,
      parentName: rootName,
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

    if (classified.kind === "registry" || classified.kind === "marketplace") {
      throw new ResolverError(
        "RESOLVE_REGISTRY_DEFERRED",
        `Registry dependency fetch is deferred/unsupported in M3 (id=${classified.id ?? "?"}); ` +
          `registry HTTP client is out of scope — not falling back to git`,
      );
    }

    if (classified.kind === "local") {
      await resolveLocal(item, classified, {
        cwd,
        downloader,
        edgesByIdentity,
        visitOrder,
        queue,
        expanded,
      });
      continue;
    }

    // git-semver / git-literal
    await resolveGit(item, classified, {
      cwd,
      gitRemote,
      tagLister,
      downloader,
      updateRefs,
      warmByIdentity,
      edgesByIdentity,
      visitOrder,
      queue,
      expanded,
    });
  }

  // Intersection-pick per identity
  const nodes = await applyIntersectionPick(edgesByIdentity, tagLister);

  return { nodes, visitOrder };
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
    const identity = normalizeRepoIdentity(repo.includes("://") ? repo : `https://${repo}`);
    map.set(identity, {
      repo_url: repo,
      resolved_commit: typeof d.resolved_commit === "string" ? d.resolved_commit : undefined,
      constraint: typeof d.constraint === "string" ? d.constraint : undefined,
      resolved_tag: typeof d.resolved_tag === "string" ? d.resolved_tag : undefined,
      resolved_at: typeof d.resolved_at === "string" ? d.resolved_at : undefined,
    });
  }
  return map;
}

async function resolveLocal(
  item: QueueItem,
  classified: ClassifiedDependency,
  ctx: {
    cwd: string;
    downloader: Downloader;
    edgesByIdentity: Map<string, EdgeRecord[]>;
    visitOrder: string[];
    queue: QueueItem[];
    expanded: Set<string>;
  },
): Promise<void> {
  const rel = classified.path!;
  const abs = isAbsolute(rel) ? rel : resolve(item.fromDir, rel);
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

  // Materialize local into modules cache (copy) for lock parity — optional but helpful
  const dest = modulesCacheDest(ctx.cwd, identity.replace(/^local:/, "local_"));
  await ctx.downloader.download({ path: abs, dest, identity });

  const record: EdgeRecord = {
    identity,
    kind: "local",
    classified,
    depth: item.depth,
    chain,
    name,
    path: abs,
    packageRoot: existsSync(dest) ? dest : abs,
    repo_url: identity,
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
    updateRefs: boolean;
    warmByIdentity: Map<string, WarmPin>;
    edgesByIdentity: Map<string, EdgeRecord[]>;
    visitOrder: string[];
    queue: QueueItem[];
    expanded: Set<string>;
  },
): Promise<void> {
  const gitUrl = classified.git!;
  const identity = normalizeRepoIdentity(gitUrl);
  const lockUrl = toLockRepoUrl(gitUrl);
  const warm = ctx.warmByIdentity.get(identity);

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
      !ctx.updateRefs &&
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
      !ctx.updateRefs && Boolean(warm?.resolved_commit) && warmConstraintMatchesLiteral(warm, ref);

    if (warmOk) {
      resolved_commit = warm!.resolved_commit;
    } else {
      resolved_commit = await ctx.gitRemote.resolveRef(gitUrl, ref);
    }
  }

  // Download to read child manifest
  const dest = modulesCacheDest(ctx.cwd, identity, resolved_commit);
  await ctx.downloader.download({
    repoUrl: gitUrl,
    commit: resolved_commit,
    dest,
    identity,
  });

  let childName = nameHint;
  let childDeps: DependencyEntry[] = [];
  try {
    const child = loadManifest({ cwd: dest });
    childName = child.document.name;
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
    constraint: e.constraint,
    resolved_tag: e.resolved_tag,
    resolved_at: e.resolved_at,
    packageRoot: e.packageRoot,
  };
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
