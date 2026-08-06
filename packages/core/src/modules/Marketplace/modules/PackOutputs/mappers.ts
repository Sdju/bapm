import type { MarketplaceAuthoringConfig } from "../Authoring/types.ts";
import { MarketplacePackOutputsError } from "./errors.ts";
import type { ResolvedPackage } from "./types.ts";

function ownerName(config: MarketplaceAuthoringConfig): string {
  const owner = config.owner;
  if (!owner) return "unknown";
  if (typeof owner === "string") return owner;
  return owner.name;
}

function ownerObject(config: MarketplaceAuthoringConfig): Record<string, string> {
  const owner = config.owner;
  if (!owner) return { name: "unknown" };
  if (typeof owner === "string") return { name: owner };
  const out: Record<string, string> = { name: owner.name };
  if (owner.email) out.email = owner.email;
  if (owner.url) out.url = owner.url;
  return out;
}

function remoteSourceUrl(pkg: ResolvedPackage): string | undefined {
  if (pkg.sourceUrl) return pkg.sourceUrl;
  if (pkg.host) return `https://${pkg.host}/${pkg.sourceRepo}`;
  return undefined;
}

function setTagPattern(sourceObj: Record<string, unknown>, pkg: ResolvedPackage): void {
  if (pkg.effectiveTagPattern) sourceObj.tag_pattern = pkg.effectiveTagPattern;
}

function claudeRemoteSource(pkg: ResolvedPackage): Record<string, unknown> {
  const sourceObj: Record<string, unknown> = {};
  const remoteUrl = remoteSourceUrl(pkg);
  if (pkg.subdir) {
    sourceObj.source = "git-subdir";
    sourceObj.url = remoteUrl || pkg.sourceRepo;
    sourceObj.path = pkg.subdir;
  } else if (remoteUrl) {
    sourceObj.source = "url";
    sourceObj.url = remoteUrl;
  } else {
    sourceObj.source = "github";
    sourceObj.repo = pkg.sourceRepo;
  }
  if (pkg.ref) sourceObj.ref = pkg.ref;
  if (pkg.sha) sourceObj.sha = pkg.sha;
  setTagPattern(sourceObj, pkg);
  return sourceObj;
}

function codexSource(pkg: ResolvedPackage): Record<string, unknown> {
  if (pkg.isLocal) {
    return { source: "local", path: pkg.source };
  }
  if (pkg.subdir) {
    const sourceObj: Record<string, unknown> = {
      source: "git-subdir",
      url: remoteSourceUrl(pkg) || pkg.sourceRepo,
      path: pkg.subdir,
    };
    if (pkg.ref) sourceObj.ref = pkg.ref;
    if (pkg.sha) sourceObj.sha = pkg.sha;
    setTagPattern(sourceObj, pkg);
    return sourceObj;
  }
  const sourceObj: Record<string, unknown> = {
    source: "url",
    url: remoteSourceUrl(pkg) || pkg.sourceRepo,
  };
  if (pkg.ref) sourceObj.ref = pkg.ref;
  if (pkg.sha) sourceObj.sha = pkg.sha;
  setTagPattern(sourceObj, pkg);
  return sourceObj;
}

/** Anthropic-shaped Claude marketplace.json document. */
export function mapClaudeMarketplace(
  config: MarketplaceAuthoringConfig,
  resolved: ResolvedPackage[],
): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    name: config.name ?? "marketplace",
  };
  if (config.description) doc.description = config.description;
  if (config.version) doc.version = config.version;
  doc.owner = ownerObject(config);
  if (config.metadata) doc.metadata = config.metadata;

  const plugins: Record<string, unknown>[] = [];
  for (const pkg of resolved) {
    const entry = pkg.entry;
    const plugin: Record<string, unknown> = { name: pkg.name };
    if (entry.description) plugin.description = entry.description;
    if (entry.version && !entry.version.match(/[\^~><=* ]/)) plugin.version = entry.version;
    if (entry.author) plugin.author = entry.author;
    if (entry.license) plugin.license = entry.license;
    if (entry.repository) plugin.repository = entry.repository;
    if (pkg.tags.length) plugin.tags = [...pkg.tags];
    if (entry.category) plugin.category = entry.category;
    if (pkg.isLocal && entry.homepage) plugin.homepage = entry.homepage;

    if (pkg.isLocal) {
      plugin.source = pkg.source;
    } else {
      plugin.source = claudeRemoteSource(pkg);
    }
    // Strip APM-only fields that must never appear on plugin entries
    delete plugin.tag_pattern;
    delete plugin.include_prerelease;
    delete plugin.isLocal;
    delete plugin.is_local;
    plugins.push(plugin);
  }
  doc.plugins = plugins;
  return doc;
}

/** Codex-shaped marketplace.json; fails closed when category missing. */
export function mapCodexMarketplace(
  config: MarketplaceAuthoringConfig,
  resolved: ResolvedPackage[],
): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    name: config.name ?? "marketplace",
    interface: { displayName: config.name ?? ownerName(config) },
  };

  const plugins: Record<string, unknown>[] = [];
  for (const pkg of resolved) {
    const entry = pkg.entry;
    if (!entry.category) {
      throw new MarketplacePackOutputsError(
        `package '${entry.name}' is missing category required for Codex output`,
      );
    }
    plugins.push({
      name: pkg.name,
      source: codexSource(pkg),
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: entry.category,
    });
  }
  doc.plugins = plugins;
  return doc;
}

export function serializeMarketplaceJson(doc: Record<string, unknown>): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
