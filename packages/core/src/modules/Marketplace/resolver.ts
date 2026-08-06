/**
 * Parse NAME@MARKETPLACE[#ref] and resolve marketplace plugins to concrete deps.
 * Mirrors APM marketplace/resolver.py (consumer floor subset).
 */

import { isAbsolute, resolve as pathResolve } from "node:path";
import {
  MarketplaceNotFoundError,
  MarketplacePluginNotFoundError,
  MarketplaceUnsupportedSourceError,
} from "./errors.ts";
import { fetchMarketplace } from "./fetch.ts";
import {
  resolveLocalFilesystemPath,
  type MarketplaceManifest,
  type MarketplacePlugin,
  type MarketplaceSource,
} from "./models.ts";
import { getMarketplace } from "./registry.ts";
import type { MarketplaceConfigOptions, MarketplaceFetchOptions } from "./types.ts";

const MARKETPLACE_RE = /^([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+)(?:#(.+))?$/;
const SEMVER_RANGE_CHARS = /[~^<>=!]/;

export type ParsedMarketplaceRef = {
  pluginName: string;
  marketplaceName: string;
  ref: string | null;
};

export type MarketplaceProvenance = {
  discovered_via: string;
  marketplace_plugin_name: string;
  source_url?: string;
  source_digest?: string;
};

/** Concrete dependency declaration for Resolver/Install (string or object form). */
export type MarketplaceConcreteDep = string | { path: string } | { git: string; ref?: string };

export type MarketplacePluginResolution = {
  /** Canonical string or structured concrete dependency. */
  dependency: MarketplaceConcreteDep;
  /** Alias for soft-resolve helpers / APM parity. */
  canonical: string | MarketplaceConcreteDep;
  plugin: MarketplacePlugin;
  source_url: string;
  source_digest: string;
  provenance(marketplaceName?: string, pluginName?: string): MarketplaceProvenance;
};

export type ResolveMarketplacePluginOptions = MarketplaceFetchOptions & {
  /** Alias accepted by acceptance helpers. */
  marketplaceConfigDir?: string;
};

/**
 * Parse `NAME@MARKETPLACE[#ref]`.
 * Returns null when the specifier is not a marketplace ref.
 * Throws when `#ref` contains semver-range characters.
 */
export function parseMarketplaceRef(specifier: string): ParsedMarketplaceRef | null {
  const s = specifier.trim();
  const head = s.split("#", 1)[0] ?? s;
  if (head.includes("/") || head.includes(":")) {
    return null;
  }
  const match = MARKETPLACE_RE.exec(s);
  if (!match) return null;
  const ref = match[3] ?? null;
  if (ref && SEMVER_RANGE_CHARS.test(ref)) {
    throw new Error(
      "Semver ranges are not supported in marketplace refs. " +
        "Use a raw git tag, branch, or SHA instead " +
        "(e.g. 'plugin@mkt#v2.0.0'). Invalid ref contains range characters (~^<>=!).",
    );
  }
  return {
    pluginName: match[1]!,
    marketplaceName: match[2]!,
    ref,
  };
}

function configOpts(opts?: ResolveMarketplacePluginOptions): MarketplaceConfigOptions {
  const configDir = opts?.configDir ?? opts?.marketplaceConfigDir;
  return configDir ? { configDir } : {};
}

function isGithubHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === "github.com" || h === "ghe.com" || h.endsWith(".ghe.com");
}

function hostnameOfUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function coerceDictSourceType(source: Record<string, unknown>): string {
  for (const key of ["type", "source", "kind"] as const) {
    const v = source[key];
    if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  }
  const repo = source.repo;
  if (typeof repo === "string" && repo.includes("/")) return "github";
  return "";
}

function resolveGithubDict(
  source: Record<string, unknown>,
  versionSpec: string | null | undefined,
): MarketplaceConcreteDep {
  const repoRaw = source.repo ?? source.repository;
  if (typeof repoRaw !== "string" || !repoRaw.includes("/")) {
    throw new Error(
      `Invalid github source: 'repo' (or 'repository') must be 'owner/repo', got '${String(repoRaw)}'`,
    );
  }
  let repo = repoRaw.trim().replace(/\.git$/, "");
  // Host-qualified github.com/owner/repo → normalize
  if (repo.toLowerCase().startsWith("github.com/")) {
    repo = repo.slice("github.com/".length);
  }
  const path =
    typeof source.path === "string" ? source.path.replace(/^\/+|\/+$/g, "") : "";
  const declaredRef =
    (typeof versionSpec === "string" && versionSpec) ||
    (typeof source.ref === "string" ? source.ref : "") ||
    "";
  const base = path ? `${repo}/${path}` : repo;
  if (declaredRef) return `${base}#${declaredRef}`;
  return base;
}

function resolveUrlDict(
  source: Record<string, unknown>,
  pluginName: string,
  versionSpec: string | null | undefined,
): MarketplaceConcreteDep {
  const url = typeof source.url === "string" ? source.url.trim() : "";
  if (!url) {
    throw new MarketplaceUnsupportedSourceError(pluginName, "URL source requires a non-empty 'url'");
  }
  const host = hostnameOfUrl(url);
  if (host && !isGithubHostname(host) && !url.startsWith("file:")) {
    // Refuse gitlab/ado/enterprise hosts in this slice (no new fetchers).
    if (
      host === "gitlab.com" ||
      host.endsWith(".gitlab.com") ||
      host === "dev.azure.com" ||
      host.endsWith(".visualstudio.com") ||
      host.includes("gitlab")
    ) {
      throw new MarketplaceUnsupportedSourceError(
        pluginName,
        `unsupported host '${host}' (gitlab/ado not supported); use github or local`,
      );
    }
  }
  const ref =
    (typeof versionSpec === "string" && versionSpec) ||
    (typeof source.ref === "string" ? source.ref : "") ||
    "";
  if (ref) return { git: url, ref };
  return { git: url };
}

function resolveRelativeLocal(
  relative: string,
  marketplace: MarketplaceSource,
  pluginRoot: string,
): MarketplaceConcreteDep {
  let rel = relative.trim().replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
  if (pluginRoot && rel && !rel.includes("/")) {
    const root = pluginRoot.trim().replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
    if (root) rel = `${root}/${rel}`;
  }
  const marketplacePath = resolveLocalFilesystemPath(marketplace);
  // url may point at marketplace root dir or a marketplace.json file
  const root = marketplacePath.endsWith(".json")
    ? pathResolve(marketplacePath, "..")
    : marketplacePath;
  const abs = rel && rel !== "." ? pathResolve(root, rel) : root;
  if (!isAbsolute(abs)) {
    return { path: abs };
  }
  return { path: abs };
}

function mapPluginSource(args: {
  plugin: MarketplacePlugin;
  marketplace: MarketplaceSource;
  manifest: MarketplaceManifest;
  versionSpec: string | null | undefined;
}): MarketplaceConcreteDep {
  const { plugin, marketplace, manifest, versionSpec } = args;
  const source = plugin.source;

  // G10: registry-routed only → DEFER (fail closed). Concrete source wins.
  const hasConcrete =
    source !== null &&
    source !== undefined &&
    !(typeof source === "object" && !Array.isArray(source) && Object.keys(source as object).length === 0);

  if (plugin.registry && !hasConcrete) {
    throw new MarketplaceUnsupportedSourceError(
      plugin.name,
      "registry-routed plugins are deferred/unsupported in this release " +
        "(no installable github/local/url source; Registry HTTP is not used for marketplace routing)",
    );
  }

  if (!hasConcrete) {
    throw new MarketplaceUnsupportedSourceError(
      plugin.name,
      "no installable source defined (expected github, local relative path, or HTTPS git url)",
    );
  }

  if (typeof source === "string") {
    if (marketplace.kind === "local") {
      return resolveRelativeLocal(source, marketplace, manifest.pluginRoot);
    }
    // Relative string on a remote marketplace → owner/repo/subdir (github-shaped)
    if (marketplace.owner && marketplace.repo) {
      let rel = source.trim().replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
      if (manifest.pluginRoot && rel && !rel.includes("/")) {
        const root = manifest.pluginRoot.trim().replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
        if (root) rel = `${root}/${rel}`;
      }
      const base =
        rel && rel !== "."
          ? `${marketplace.owner}/${marketplace.repo}/${rel}`
          : `${marketplace.owner}/${marketplace.repo}`;
      if (versionSpec) return `${base}#${versionSpec}`;
      return base;
    }
    throw new MarketplaceUnsupportedSourceError(
      plugin.name,
      "relative plugin source requires a local marketplace or owner/repo marketplace coordinates",
    );
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new MarketplaceUnsupportedSourceError(
      plugin.name,
      `unrecognized source format: ${source === null ? "null" : typeof source}`,
    );
  }

  const dict = source as Record<string, unknown>;
  const sourceType = coerceDictSourceType(dict);

  if (sourceType === "github") {
    return resolveGithubDict(dict, versionSpec);
  }
  if (sourceType === "url") {
    return resolveUrlDict(dict, plugin.name, versionSpec);
  }
  if (sourceType === "gitlab" || sourceType === "ado") {
    throw new MarketplaceUnsupportedSourceError(
      plugin.name,
      `unsupported source type '${sourceType}' (host not supported in this release)`,
    );
  }
  if (sourceType === "npm") {
    throw new MarketplaceUnsupportedSourceError(
      plugin.name,
      "npm source type is not supported; APM/bapm require Git-based or local sources",
    );
  }
  if (sourceType === "git-subdir") {
    // Treat as github-shaped owner/repo[/subdir] when repo is bare shorthand
    return resolveGithubDict(
      {
        ...dict,
        path: dict.subdir ?? dict.path,
      },
      versionSpec,
    );
  }

  throw new MarketplaceUnsupportedSourceError(
    plugin.name,
    sourceType
      ? `unsupported source type '${sourceType}'`
      : "dict source with no type and no inferrable repo field",
  );
}

function makeResolution(args: {
  dependency: MarketplaceConcreteDep;
  plugin: MarketplacePlugin;
  sourceUrl: string;
  sourceDigest: string;
  marketplaceName: string;
}): MarketplacePluginResolution {
  const { dependency, plugin, sourceUrl, sourceDigest, marketplaceName } = args;
  const resolution: MarketplacePluginResolution = {
    dependency,
    canonical: dependency,
    plugin,
    source_url: sourceUrl,
    source_digest: sourceDigest,
    provenance(via = marketplaceName, pluginName = plugin.name) {
      const data: MarketplaceProvenance = {
        discovered_via: via,
        marketplace_plugin_name: pluginName,
      };
      if (sourceUrl) data.source_url = sourceUrl;
      if (sourceDigest) data.source_digest = sourceDigest;
      return data;
    },
  };
  return resolution;
}

/**
 * Resolve a marketplace plugin via `~/.bapm` registry + fetch/cache → concrete dep.
 */
export async function resolveMarketplacePlugin(
  pluginName: string,
  marketplaceName: string,
  versionSpec?: string | null,
  opts?: ResolveMarketplacePluginOptions,
): Promise<MarketplacePluginResolution> {
  const cfg = configOpts(opts);
  const source = getMarketplace(marketplaceName, cfg);
  if (!source) {
    throw new MarketplaceNotFoundError(marketplaceName);
  }

  const manifest = await fetchMarketplace(source, { ...opts, ...cfg });
  const plugin = manifest.findPlugin(pluginName);
  if (!plugin) {
    throw new MarketplacePluginNotFoundError(pluginName, marketplaceName);
  }

  // Ignore registry when concrete source exists (D1 / G10).
  const dependency = mapPluginSource({
    plugin,
    marketplace: source,
    manifest,
    versionSpec: versionSpec ?? null,
  });

  return makeResolution({
    dependency,
    plugin,
    sourceUrl: manifest.sourceUrl,
    sourceDigest: manifest.sourceDigest,
    marketplaceName,
  });
}
