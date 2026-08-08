/**
 * Extends chain resolve (pl-003/004/006): depth ≤5, cycle detect, host-class pin, §6.4 merge.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { PolicyError } from "./errors.ts";
import { hostClassOf } from "./hostClass.ts";
import { mergeDocuments } from "./merge.ts";
import { parsePolicyDocument } from "./parse.ts";
import type { PolicyDocument } from "./types.ts";
import { loadYamlDocument } from "./yaml-load.ts";

/** Max ancestor hops from leaf (OpenAPM pl-003). */
export const POLICY_EXTENDS_MAX_DEPTH = 5;

export type FetchAncestorResult = {
  document?: PolicyDocument | Record<string, unknown>;
  policy?: PolicyDocument | Record<string, unknown>;
  source?: string;
  url?: string;
  hostClass?: string;
  path?: string;
  text?: string;
};

export type FetchAncestor = (
  ref: string,
  context: { leafHostClass: string; chain: string[] },
) => FetchAncestorResult | PolicyDocument | Record<string, unknown>;

export type ResolvePolicyChainOptions = {
  cwd?: string;
  path?: string;
  leafPath?: string;
  /** Pre-loaded leaf YAML text. */
  leafYaml?: string;
  /** Pre-parsed leaf document. */
  leaf?: PolicyDocument | Record<string, unknown>;
  document?: PolicyDocument | Record<string, unknown>;
  /** Pin class for the leaf (optional; derived from leafHostClass / remotes / local). */
  leafHostClass?: string;
  /** Injectable ancestor fetcher for owner/repo / URL refs. */
  fetchAncestor?: FetchAncestor;
  /** Optional HTTP helper used when fetchAncestor is absent. */
  fetchPolicyUrl?: (url: string) => {
    ok?: boolean;
    text?: string;
    body?: string;
    status?: number;
    url?: string;
  };
  httpGet?: (url: string) => {
    ok?: boolean;
    text?: string;
    body?: string;
    status?: number;
    url?: string;
  };
};

export type ResolvePolicyChainResult = {
  document: PolicyDocument;
  policy: PolicyDocument;
  effective: PolicyDocument;
  chain: string[];
  sourcePath?: string;
  warnings: unknown[];
};

/**
 * Resolve `extends:` into one effective policy document.
 */
export function resolvePolicyChain(
  options: ResolvePolicyChainOptions = {},
): ResolvePolicyChainResult {
  const leafPath = options.leafPath ?? options.path;
  const cwd = options.cwd ?? (leafPath ? dirname(leafPath) : process.cwd());

  let leafDoc: PolicyDocument;
  let sourcePath = leafPath;
  const warnings: unknown[] = [];

  if (options.leaf || options.document) {
    const parsed = parsePolicyDocument(options.leaf ?? options.document);
    leafDoc = parsed.document;
    warnings.push(...parsed.warnings);
  } else if (options.leafYaml !== undefined) {
    const raw = loadYamlDocument(options.leafYaml, leafPath ?? "leaf.yml");
    const parsed = parsePolicyDocument(raw);
    leafDoc = parsed.document;
    warnings.push(...parsed.warnings);
  } else if (leafPath) {
    if (!existsSync(leafPath)) {
      throw new PolicyError("POLICY_MISSING_FILE", `Policy file not found: ${leafPath}`, {
        path: leafPath,
      });
    }
    const text = readFileSync(leafPath, "utf8");
    const raw = loadYamlDocument(text, leafPath);
    const parsed = parsePolicyDocument(raw);
    leafDoc = parsed.document;
    warnings.push(...parsed.warnings);
  } else {
    throw new PolicyError(
      "POLICY_VALIDATION",
      "resolvePolicyChain requires leaf, leafYaml, or path",
    );
  }

  const leafHostClass =
    options.leafHostClass ??
    (typeof leafDoc.extends === "string" && /^https?:\/\//i.test(leafDoc.extends)
      ? hostClassOf({ url: leafDoc.extends })
      : "local");

  const chainIds: string[] = [];
  const docs: PolicyDocument[] = [];

  walk(leafDoc, {
    cwd,
    baseDir: leafPath ? dirname(leafPath) : cwd,
    leafHostClass,
    fetchAncestor: options.fetchAncestor,
    fetchPolicyUrl: options.fetchPolicyUrl,
    httpGet: options.httpGet,
    depth: 0,
    chainIds,
    docs,
    sourceHint: sourcePath ?? leafDoc.name,
  });

  // docs[0] is leaf, docs[n] is root ancestor — merge parent→child from root to leaf
  let effective = docs[docs.length - 1]!;
  for (let i = docs.length - 2; i >= 0; i--) {
    effective = mergeDocuments(effective, docs[i]!);
  }

  return {
    document: effective,
    policy: effective,
    effective,
    chain: chainIds,
    sourcePath,
    warnings,
  };
}

/** Alias names accepted by acceptance helpers. */
export const resolveExtends = resolvePolicyChain;
export const resolvePolicyExtends = resolvePolicyChain;
export const mergePolicyChain = resolvePolicyChain;

type WalkCtx = {
  cwd: string;
  baseDir: string;
  leafHostClass: string;
  fetchAncestor?: FetchAncestor;
  fetchPolicyUrl?: ResolvePolicyChainOptions["fetchPolicyUrl"];
  httpGet?: ResolvePolicyChainOptions["httpGet"];
  depth: number;
  chainIds: string[];
  docs: PolicyDocument[];
  sourceHint: string;
};

function walk(doc: PolicyDocument, ctx: WalkCtx): void {
  const id = identityOf(doc, ctx.sourceHint);
  if (ctx.chainIds.includes(id) || ctx.chainIds.includes(doc.name)) {
    const members = [...ctx.chainIds, id].join(" → ");
    throw new PolicyError(
      "POLICY_EXTENDS_CYCLE",
      `Policy extends cycle detected involving: ${members}`,
      { details: { chain: ctx.chainIds, cycle: id, name: doc.name } },
    );
  }

  if (ctx.depth > POLICY_EXTENDS_MAX_DEPTH) {
    throw new PolicyError(
      "POLICY_EXTENDS_DEPTH",
      `Policy extends chain exceeds max depth ${POLICY_EXTENDS_MAX_DEPTH} (too deep)`,
      { details: { depth: ctx.depth, max: POLICY_EXTENDS_MAX_DEPTH, chain: ctx.chainIds } },
    );
  }

  ctx.chainIds.push(id);
  ctx.docs.push(doc);

  const extendsRef = typeof doc.extends === "string" ? doc.extends.trim() : undefined;
  if (!extendsRef) return;

  const nextDepth = ctx.depth + 1;
  if (nextDepth > POLICY_EXTENDS_MAX_DEPTH) {
    throw new PolicyError(
      "POLICY_EXTENDS_DEPTH",
      `Policy extends chain exceeds max depth ${POLICY_EXTENDS_MAX_DEPTH} (too deep)`,
      { details: { depth: nextDepth, max: POLICY_EXTENDS_MAX_DEPTH, chain: ctx.chainIds } },
    );
  }

  const fetched = fetchParent(extendsRef, ctx);
  const parentDoc = fetched.document;
  const parentHost = fetched.hostClass ?? ctx.leafHostClass;

  if (parentHost !== ctx.leafHostClass) {
    throw new PolicyError(
      "POLICY_HOST_CLASS_PIN",
      `Cross-host-class extends rejected: leaf host class "${ctx.leafHostClass}" vs ancestor "${parentHost}" (host-class pin)`,
      {
        details: {
          leafHostClass: ctx.leafHostClass,
          ancestorHostClass: parentHost,
          ref: extendsRef,
        },
      },
    );
  }

  walk(parentDoc, {
    ...ctx,
    depth: nextDepth,
    baseDir: fetched.baseDir ?? ctx.baseDir,
    sourceHint: fetched.sourceHint ?? extendsRef,
  });
}

function fetchParent(
  ref: string,
  ctx: WalkCtx,
): { document: PolicyDocument; hostClass?: string; baseDir?: string; sourceHint?: string } {
  // Relative / local path
  if (
    ref.startsWith("./") ||
    ref.startsWith("../") ||
    ref.endsWith(".yml") ||
    ref.endsWith(".yaml")
  ) {
    const absolute = isAbsolute(ref) ? resolve(ref) : resolve(ctx.baseDir, ref);
    if (!existsSync(absolute)) {
      throw new PolicyError("POLICY_EXTENDS_FETCH", `Extends policy file not found: ${ref}`, {
        path: absolute,
        details: { ref },
      });
    }
    // Cycle via same path
    if (
      ctx.chainIds.includes(absolute) ||
      ctx.chainIds.some((c) => c.endsWith(ref.replace(/^\.\//, "")))
    ) {
      // still allow walk to detect via name/path id
    }
    const text = readFileSync(absolute, "utf8");
    const raw = loadYamlDocument(text, absolute);
    const parsed = parsePolicyDocument(raw);
    return {
      document: parsed.document,
      hostClass: ctx.leafHostClass,
      baseDir: dirname(absolute),
      sourceHint: absolute,
    };
  }

  if (ctx.fetchAncestor) {
    const result = ctx.fetchAncestor(ref, {
      leafHostClass: ctx.leafHostClass,
      chain: [...ctx.chainIds],
    });
    return normalizeFetchResult(result, ref, ctx.leafHostClass);
  }

  // URL form
  if (/^https?:\/\//i.test(ref)) {
    const urlHost = hostClassOf({ url: ref });
    if (urlHost !== ctx.leafHostClass) {
      throw new PolicyError(
        "POLICY_HOST_CLASS_PIN",
        `Cross-host-class extends rejected: leaf host class "${ctx.leafHostClass}" vs URL host class "${urlHost}" (host-class pin)`,
        { details: { leafHostClass: ctx.leafHostClass, ancestorHostClass: urlHost, ref } },
      );
    }
    const text = httpFetchText(ref, ctx);
    const raw = loadYamlDocument(text, ref);
    const parsed = parsePolicyDocument(raw);
    return { document: parsed.document, hostClass: urlHost, sourceHint: ref };
  }

  // owner/repo — requires injectable fetcher in tests; production may use Contents API later
  throw new PolicyError(
    "POLICY_EXTENDS_FETCH",
    `Extends fetch failed for "${ref}" (missing ancestor fetcher or not found)`,
    { details: { ref } },
  );
}

function normalizeFetchResult(
  result: FetchAncestorResult | PolicyDocument | Record<string, unknown>,
  ref: string,
  leafHostClass: string,
): { document: PolicyDocument; hostClass?: string; baseDir?: string; sourceHint?: string } {
  if (!result || typeof result !== "object") {
    throw new PolicyError("POLICY_EXTENDS_FETCH", `Extends fetch failed for "${ref}"`, {
      details: { ref },
    });
  }
  const r = result as FetchAncestorResult & Record<string, unknown>;
  const rawDoc = r.document ?? r.policy ?? (r.name !== undefined ? r : undefined);
  if (!rawDoc || typeof rawDoc !== "object") {
    throw new PolicyError(
      "POLICY_EXTENDS_FETCH",
      `Extends fetch returned no document for "${ref}"`,
      {
        details: { ref },
      },
    );
  }
  const parsed =
    "enforcement" in (rawDoc as object) && "name" in (rawDoc as object)
      ? { document: rawDoc as PolicyDocument }
      : parsePolicyDocument(rawDoc);

  let hostClass = r.hostClass;
  if (!hostClass && r.url) hostClass = hostClassOf({ url: String(r.url) });
  if (!hostClass && /^https?:\/\//i.test(ref)) hostClass = hostClassOf({ url: ref });
  if (!hostClass) hostClass = leafHostClass;

  return {
    document:
      "warnings" in parsed ? (parsed as { document: PolicyDocument }).document : parsed.document,
    hostClass,
    sourceHint: r.source ?? r.url ?? r.path ?? ref,
    baseDir: r.path ? dirname(String(r.path)) : undefined,
  };
}

function httpFetchText(url: string, ctx: WalkCtx): string {
  const fetcher = ctx.fetchPolicyUrl ?? ctx.httpGet;
  if (!fetcher) {
    throw new PolicyError(
      "POLICY_EXTENDS_FETCH",
      `Extends fetch failed for URL "${url}" (no HTTP fetcher)`,
      {
        details: { url },
      },
    );
  }
  try {
    const res = fetcher(url);
    const text = res.text ?? res.body;
    if (res.ok === false || text == null) {
      throw new PolicyError(
        "POLICY_EXTENDS_FETCH",
        `Extends fetch failed for URL "${url}" (status ${res.status ?? "unknown"})`,
        { details: { url, status: res.status } },
      );
    }
    return text;
  } catch (cause) {
    if (cause instanceof PolicyError) throw cause;
    throw new PolicyError(
      "POLICY_EXTENDS_FETCH",
      `Extends fetch failed for URL "${url}": ${cause instanceof Error ? cause.message : String(cause)}`,
      { details: { url }, cause },
    );
  }
}

function identityOf(doc: PolicyDocument, sourceHint: string): string {
  if (sourceHint && (sourceHint.includes("/") || sourceHint.endsWith(".yml"))) {
    return resolve(sourceHint);
  }
  return doc.name || sourceHint;
}
