import semver from "semver";
import {
  createMarketplaceManifest,
  createMarketplacePlugin,
  type MarketplaceManifest,
  type MarketplacePlugin,
} from "./models.ts";

function parsePluginEntry(
  entry: Record<string, unknown>,
  sourceName: string,
): MarketplacePlugin | null {
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  if (!name) return null;

  const description = typeof entry.description === "string" ? entry.description : "";
  const version = typeof entry.version === "string" ? entry.version : "";
  const rawTags = entry.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.filter((t): t is string => typeof t === "string")
    : [];

  let source: unknown = null;

  if ("source" in entry) {
    const raw = entry.source;
    if (typeof raw === "string") {
      source = raw;
    } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = { ...(raw as Record<string, unknown>) };
      const sourceType =
        (typeof obj.type === "string" ? obj.type : "") ||
        (typeof obj.source === "string" ? obj.source : "");
      if (sourceType === "npm") return null;
      if (sourceType && !("type" in obj)) obj.type = sourceType;
      source = obj;
    } else {
      return null;
    }
  } else if ("repository" in entry) {
    const repo = entry.repository;
    const ref = typeof entry.ref === "string" ? entry.ref : "";
    if (typeof repo === "string" && repo.includes("/")) {
      const githubSource: Record<string, unknown> = { type: "github", repo };
      if (ref) githubSource.ref = ref;
      source = githubSource;
    } else {
      return null;
    }
  }

  let registryName = "";
  const rawRegistry = entry.registry;
  if (rawRegistry !== undefined && rawRegistry !== null) {
    if (typeof rawRegistry === "string" && rawRegistry.trim()) {
      registryName = rawRegistry.trim();
    } else {
      throw new Error(`Plugin '${name}' has invalid 'registry' field; expected a non-empty string`);
    }
  }

  // Registry-only plugins (no concrete source) are retained so resolve can fail closed (G10).
  if (source === null && !registryName) {
    return null;
  }

  if (registryName) {
    if (!version) {
      throw new Error(
        `Plugin '${name}' routes through registry '${registryName}' but declares no version selector`,
      );
    }
    if (!semver.validRange(version)) {
      throw new Error(
        `Plugin '${name}' routes through registry '${registryName}' ` +
          `but version '${version}' is not a valid semver selector`,
      );
    }
  }

  let tagPattern: string | null = null;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const rawTp = (source as Record<string, unknown>).tag_pattern;
    if (typeof rawTp === "string") tagPattern = rawTp;
  }

  return createMarketplacePlugin({
    name,
    source,
    description,
    version,
    tags,
    sourceMarketplace: sourceName,
    registry: registryName,
    tagPattern,
  });
}

/**
 * Parse marketplace.json (string or object) into a MarketplaceManifest.
 * Accepts Copilot (`repository`) and Claude (`source`) plugin shapes.
 */
export function parseMarketplaceJson(
  input: string | object,
  sourceName = "",
  opts?: { sourceUrl?: string; sourceDigest?: string },
): MarketplaceManifest {
  let data: unknown = input;
  if (typeof input === "string") {
    data = JSON.parse(input) as unknown;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("marketplace.json root must be an object");
  }
  const obj = data as Record<string, unknown>;

  const manifestName =
    typeof obj.name === "string" && obj.name ? obj.name : sourceName || "unknown";
  const description = typeof obj.description === "string" ? obj.description : "";
  let ownerName = "";
  if (obj.owner && typeof obj.owner === "object" && !Array.isArray(obj.owner)) {
    const n = (obj.owner as Record<string, unknown>).name;
    if (typeof n === "string") ownerName = n;
  } else if (typeof obj.owner === "string") {
    ownerName = obj.owner;
  }

  let pluginRoot = "";
  if (obj.metadata && typeof obj.metadata === "object" && !Array.isArray(obj.metadata)) {
    const rawRoot = (obj.metadata as Record<string, unknown>).pluginRoot;
    if (typeof rawRoot === "string") pluginRoot = rawRoot.trim();
  }

  const rawPlugins: unknown[] = Array.isArray(obj.plugins) ? obj.plugins : [];

  const plugins: MarketplacePlugin[] = [];
  for (const entry of rawPlugins) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const plugin = parsePluginEntry(entry as Record<string, unknown>, sourceName);
    if (plugin) plugins.push(plugin);
  }

  return createMarketplaceManifest({
    name: manifestName,
    plugins,
    ownerName,
    description,
    pluginRoot,
    sourceUrl:
      opts?.sourceUrl ||
      (typeof obj.source_url === "string" ? obj.source_url : "") ||
      "",
    sourceDigest:
      opts?.sourceDigest ||
      (typeof obj.source_digest === "string" ? obj.source_digest : "") ||
      "",
  });
}
