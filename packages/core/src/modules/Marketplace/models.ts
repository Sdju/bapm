import { homedir } from "node:os";
import { resolve as pathResolve } from "node:path";
import { classifyMarketplaceHostKind } from "./hostClassify.ts";
import type { MarketplaceSourceInit, MarketplaceSourceKind } from "./types.ts";

function looksLikeLocalPath(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("file://")) return true;
  if (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("~/") ||
    value === "~"
  ) {
    return true;
  }
  return (
    value.length >= 3 &&
    /[a-zA-Z]/.test(value[0]!) &&
    value[1] === ":" &&
    (value[2] === "\\" || value[2] === "/")
  );
}

function extractHostFromUrl(url: string): string {
  if (!url || looksLikeLocalPath(url)) return "";
  const scp = /^[^@]+@([^:]+):/.exec(url);
  if (scp) return scp[1] ?? "";
  try {
    return new URL(url).hostname || "";
  } catch {
    return "";
  }
}

function extractOwnerRepoFromUrl(url: string): { owner: string; repo: string } {
  if (!url || looksLikeLocalPath(url)) return { owner: "", repo: "" };
  let path = "";
  const scp = /^[^@]+@[^:]+:(.+)$/.exec(url);
  if (scp) {
    path = scp[1] ?? "";
  } else {
    try {
      path = new URL(url).pathname.replace(/^\//, "");
    } catch {
      return { owner: "", repo: "" };
    }
  }
  if (path.endsWith(".git")) path = path.slice(0, -4);
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2) {
    return { owner: segments.slice(0, -1).join("/"), repo: segments.at(-1)! };
  }
  if (segments.length === 1) return { owner: "", repo: segments[0]! };
  return { owner: "", repo: "" };
}

function localPathFromSource(value: string): string {
  if (value.startsWith("file://")) {
    const rest = value.slice("file://".length);
    if (rest.length >= 3 && rest[0] === "/" && /[a-zA-Z]/.test(rest[1]!) && rest[2] === ":") {
      return rest.slice(1);
    }
    if (rest.length >= 2 && /[a-zA-Z]/.test(rest[0]!) && rest[1] === ":") {
      return rest;
    }
    try {
      return decodeURIComponent(new URL(value).pathname || value);
    } catch {
      return value;
    }
  }
  if (value.startsWith("~")) {
    return value.replace(/^~(?=$|[/\\])/, homedir());
  }
  return value;
}

/** True when url is an HTTPS hosted marketplace.json document. */
export function urlNamesRemoteManifest(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol.toLowerCase() !== "https:") return false;
    if (!parsed.hostname) return false;
    return parsed.pathname.replace(/\/$/, "").endsWith("/marketplace.json");
  } catch {
    return false;
  }
}

function looksLikeRemoteManifestUrl(url: string): boolean {
  if (!url || looksLikeLocalPath(url)) return false;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return false;
    const proto = parsed.protocol.toLowerCase();
    if (proto !== "https:" && proto !== "http:") return false;
    return parsed.pathname.replace(/\/$/, "").endsWith("/marketplace.json");
  } catch {
    return false;
  }
}

function classifyHost(host: string): MarketplaceSourceKind {
  return classifyMarketplaceHostKind(host);
}

export type MarketplacePlugin = {
  readonly name: string;
  readonly source: unknown;
  readonly description: string;
  readonly version: string;
  readonly tags: readonly string[];
  readonly sourceMarketplace: string;
  readonly registry: string;
  readonly tagPattern: string | null;
};

export type MarketplaceManifest = {
  readonly name: string;
  readonly plugins: readonly MarketplacePlugin[];
  readonly ownerName: string;
  readonly description: string;
  readonly pluginRoot: string;
  readonly sourceUrl: string;
  readonly sourceDigest: string;
  findPlugin(pluginName: string): MarketplacePlugin | undefined;
  search(query: string): MarketplacePlugin[];
};

export function createMarketplaceManifest(init: {
  name: string;
  plugins?: readonly MarketplacePlugin[];
  ownerName?: string;
  description?: string;
  pluginRoot?: string;
  sourceUrl?: string;
  sourceDigest?: string;
}): MarketplaceManifest {
  const plugins = Object.freeze([...(init.plugins ?? [])]);
  const manifest: MarketplaceManifest = {
    name: init.name,
    plugins,
    ownerName: init.ownerName ?? "",
    description: init.description ?? "",
    pluginRoot: init.pluginRoot ?? "",
    sourceUrl: init.sourceUrl ?? "",
    sourceDigest: init.sourceDigest ?? "",
    findPlugin(pluginName: string) {
      const lower = pluginName.toLowerCase();
      return plugins.find((p) => p.name.toLowerCase() === lower);
    },
    search(query: string) {
      const q = query.toLowerCase();
      return plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    },
  };
  return Object.freeze(manifest);
}

export function createMarketplacePlugin(init: {
  name: string;
  source?: unknown;
  description?: string;
  version?: string;
  tags?: readonly string[];
  sourceMarketplace?: string;
  registry?: string;
  tagPattern?: string | null;
}): MarketplacePlugin {
  return Object.freeze({
    name: init.name,
    source: init.source ?? null,
    description: init.description ?? "",
    version: init.version ?? "",
    tags: Object.freeze([...(init.tags ?? [])]),
    sourceMarketplace: init.sourceMarketplace ?? "",
    registry: init.registry ?? "",
    tagPattern: init.tagPattern ?? null,
  });
}

export class MarketplaceSource {
  readonly name: string;
  readonly url: string;
  readonly ref: string;
  readonly path: string;
  readonly owner: string;
  readonly repo: string;
  readonly host: string;
  readonly branch: string;

  constructor(init: MarketplaceSourceInit) {
    const name = init.name;
    let url = init.url ?? "";
    let ref = init.ref ?? "main";
    let path = init.path;
    let owner = init.owner ?? "";
    let repo = init.repo ?? "";
    let host = init.host ?? "github.com";
    const branch = init.branch ?? "";

    if (branch && branch !== "main" && (!init.ref || init.ref === "main")) {
      ref = branch;
    }

    if (!url && owner && repo) {
      url = `https://${host || "github.com"}/${owner}/${repo}`;
    }

    if (path === undefined) {
      path = looksLikeRemoteManifestUrl(url) ? "" : "marketplace.json";
    }

    const isRemoteManifest = path === "" && looksLikeRemoteManifestUrl(url);
    if (url && !looksLikeLocalPath(url) && !isRemoteManifest && !owner && !repo) {
      const extracted = extractOwnerRepoFromUrl(url);
      owner = extracted.owner;
      repo = extracted.repo;
    }
    if (url && !looksLikeLocalPath(url) && !isRemoteManifest) {
      const h = extractHostFromUrl(url);
      if (h) host = h;
      else if (host === "github.com" && init.host) host = init.host;
    }

    // Fail-closed GHES↔GitLab overlap before freeze (kind getter also classifies).
    if (url && !looksLikeLocalPath(url) && !looksLikeRemoteManifestUrl(url)) {
      const remoteHost = extractHostFromUrl(url) || host;
      if (remoteHost) classifyHost(remoteHost);
    }

    this.name = name;
    this.url = url;
    this.ref = ref;
    this.path = path;
    this.owner = owner;
    this.repo = repo;
    this.host = host;
    this.branch = ref;
    Object.freeze(this);
  }

  get isRemoteManifestUrl(): boolean {
    return this.path === "" && urlNamesRemoteManifest(this.url);
  }

  get kind(): MarketplaceSourceKind {
    if (!this.url || looksLikeLocalPath(this.url)) return "local";
    if (this.path === "" && looksLikeRemoteManifestUrl(this.url)) return "url";
    const host = extractHostFromUrl(this.url);
    if (!host) return "git";
    return classifyHost(host);
  }

  get localPath(): string {
    if (this.kind !== "local") return "";
    return localPathFromSource(this.url);
  }

  get displaySource(): string {
    const k = this.kind;
    if ((k === "github" || k === "gitlab") && this.owner && this.repo) {
      return `${this.owner}/${this.repo}`;
    }
    if (k === "url") return this.url;
    if (k === "local") {
      const lp = this.localPath;
      const home = homedir();
      if (home && lp.startsWith(home)) return `~${lp.slice(home.length)}`;
      return lp || this.url;
    }
    let url = this.url;
    for (const prefix of ["https://", "http://", "git://"] as const) {
      if (url.startsWith(prefix)) return url.slice(prefix.length);
    }
    return url;
  }

  toDict(): Record<string, unknown> {
    const result: Record<string, unknown> = { name: this.name };
    if (this.url) result.url = this.url;
    if (this.ref && this.ref !== "main") result.ref = this.ref;
    if (this.path !== "marketplace.json") result.path = this.path;
    if (this.owner) result.owner = this.owner;
    if (this.repo) result.repo = this.repo;
    if (this.host && this.host !== "github.com") result.host = this.host;
    if (this.branch && this.branch !== "main") result.branch = this.branch;
    return result;
  }

  static fromDict(data: Record<string, unknown>): MarketplaceSource {
    return new MarketplaceSource({
      name: typeof data.name === "string" ? data.name : "",
      url: typeof data.url === "string" ? data.url : "",
      ref:
        typeof data.ref === "string"
          ? data.ref
          : typeof data.branch === "string"
            ? data.branch
            : "main",
      path: typeof data.path === "string" ? data.path : "marketplace.json",
      owner: typeof data.owner === "string" ? data.owner : "",
      repo: typeof data.repo === "string" ? data.repo : "",
      host: typeof data.host === "string" ? data.host : "github.com",
      branch: typeof data.branch === "string" ? data.branch : "",
    });
  }
}

/** Factory preferred by public API / soft-resolve helpers. */
export function createMarketplaceSource(init: MarketplaceSourceInit): MarketplaceSource {
  return new MarketplaceSource(init);
}

export function resolveLocalFilesystemPath(source: MarketplaceSource): string {
  const raw = source.localPath || source.url;
  return pathResolve(localPathFromSource(raw));
}
