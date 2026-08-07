import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadYamlDocument } from "@/common/yaml/loadDocument.ts";
import { YamlError } from "@/common/yaml/errors.ts";
import { MarketplaceAuthoringError } from "./errors.ts";
import { isLocalAuthoringSource, validateMarketplaceAuthoringSource } from "./source.ts";
import type {
  LoadMarketplaceFromBapmYmlOptions,
  LoadMarketplaceResult,
  MarketplaceAuthoringBuild,
  MarketplaceAuthoringConfig,
  MarketplaceAuthoringOwner,
  PackageEntry,
} from "./types.ts";

const MARKETPLACE_KEYS = new Set([
  "name",
  "description",
  "version",
  "owner",
  "sourceBase",
  "output",
  "outputs",
  "claude",
  "metadata",
  "build",
  "codex",
  "packages",
  "versioning",
]);

const PACKAGE_ENTRY_KEYS = new Set([
  "name",
  "source",
  "subdir",
  "version",
  "ref",
  "tag_pattern",
  "include_prerelease",
  "description",
  "homepage",
  "tags",
  "author",
  "license",
  "repository",
  "keywords",
  "category",
]);

const BUILD_KEYS = new Set(["tagPattern", "tag_pattern"]);

function asRecord(value: unknown, ctx: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MarketplaceAuthoringError(`'${ctx}' must be a mapping`);
  }
  return value as Record<string, unknown>;
}

function checkUnknownKeys(
  data: Record<string, unknown>,
  allowed: Set<string>,
  context: string,
): void {
  const unknown = Object.keys(data).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    throw new MarketplaceAuthoringError(
      `'${context}' has unknown key(s): ${unknown.sort().join(", ")}; ` +
        `allowed: ${[...allowed].sort().join(", ")}`,
    );
  }
}

function parseOwner(raw: unknown): MarketplaceAuthoringOwner | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) throw new MarketplaceAuthoringError("'owner' must be a non-empty string or object");
    return name;
  }
  const obj = asRecord(raw, "owner");
  const name = obj.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new MarketplaceAuthoringError("'owner.name' is required");
  }
  const out: { name: string; url?: string; email?: string } = { name: name.trim() };
  if (typeof obj.url === "string") out.url = obj.url;
  if (typeof obj.email === "string") out.email = obj.email;
  return out;
}

function parseBuild(raw: unknown): MarketplaceAuthoringBuild | undefined {
  if (raw === undefined || raw === null) return undefined;
  const obj = asRecord(raw, "build");
  checkUnknownKeys(obj, BUILD_KEYS, "build");
  const tag = obj.tagPattern ?? obj.tag_pattern;
  if (tag !== undefined && typeof tag !== "string") {
    throw new MarketplaceAuthoringError("'build.tagPattern' must be a string");
  }
  return tag !== undefined ? { tagPattern: tag } : {};
}

function parsePackageEntry(raw: unknown, index: number): PackageEntry {
  const ctx = `packages[${index}]`;
  const obj = asRecord(raw, ctx);
  checkUnknownKeys(obj, PACKAGE_ENTRY_KEYS, ctx);

  const name = obj.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new MarketplaceAuthoringError(`'${ctx}.name' is required`);
  }
  const source = obj.source;
  if (typeof source !== "string" || !source.trim()) {
    throw new MarketplaceAuthoringError(`'${ctx}.source' is required`);
  }
  const sourceCheck = validateMarketplaceAuthoringSource(source.trim());
  if (!sourceCheck.ok) {
    throw new MarketplaceAuthoringError(`'${ctx}.source': ${sourceCheck.error}`);
  }

  const version = typeof obj.version === "string" ? obj.version : undefined;
  const ref = typeof obj.ref === "string" ? obj.ref : undefined;
  if (version !== undefined && ref !== undefined) {
    throw new MarketplaceAuthoringError(
      `'${ctx}' must not set both 'version' and 'ref' (mutually exclusive)`,
    );
  }

  const isLocal = isLocalAuthoringSource(source.trim());
  const entry: PackageEntry = {
    name: name.trim(),
    source: source.trim(),
    isLocal,
    is_local: isLocal,
  };
  if (version !== undefined) entry.version = version;
  if (ref !== undefined) entry.ref = ref;
  if (typeof obj.subdir === "string") entry.subdir = obj.subdir;
  if (typeof obj.tag_pattern === "string") entry.tag_pattern = obj.tag_pattern;
  if (typeof obj.include_prerelease === "boolean") {
    entry.include_prerelease = obj.include_prerelease;
  }
  if (typeof obj.description === "string") entry.description = obj.description;
  if (typeof obj.homepage === "string") entry.homepage = obj.homepage;
  if (Array.isArray(obj.tags)) entry.tags = obj.tags.map(String);
  if (obj.author !== undefined) {
    entry.author = obj.author as PackageEntry["author"];
  }
  if (typeof obj.license === "string") entry.license = obj.license;
  if (typeof obj.repository === "string") entry.repository = obj.repository;
  if (Array.isArray(obj.keywords)) entry.keywords = obj.keywords.map(String);
  if (typeof obj.category === "string") entry.category = obj.category;
  return entry;
}

function parseMarketplaceBlock(
  rawBlock: Record<string, unknown>,
  top: Record<string, unknown>,
): MarketplaceAuthoringConfig {
  checkUnknownKeys(rawBlock, MARKETPLACE_KEYS, "marketplace");

  const packagesRaw = rawBlock.packages;
  let packages: PackageEntry[] = [];
  if (packagesRaw !== undefined && packagesRaw !== null) {
    if (!Array.isArray(packagesRaw)) {
      throw new MarketplaceAuthoringError("'marketplace.packages' must be a list");
    }
    packages = packagesRaw.map((p, i) => parsePackageEntry(p, i));
  }

  const config: MarketplaceAuthoringConfig = { packages };

  const name =
    (typeof rawBlock.name === "string" ? rawBlock.name : undefined) ??
    (typeof top.name === "string" ? top.name : undefined);
  if (name !== undefined) config.name = name;

  const description =
    (typeof rawBlock.description === "string" ? rawBlock.description : undefined) ??
    (typeof top.description === "string" ? top.description : undefined);
  if (description !== undefined) config.description = description;

  const version =
    (typeof rawBlock.version === "string" || typeof rawBlock.version === "number"
      ? String(rawBlock.version)
      : undefined) ??
    (typeof top.version === "string" || typeof top.version === "number"
      ? String(top.version)
      : undefined);
  if (version !== undefined) config.version = version;

  const owner = parseOwner(rawBlock.owner);
  if (owner !== undefined) config.owner = owner;

  if (typeof rawBlock.sourceBase === "string") config.sourceBase = rawBlock.sourceBase;
  const build = parseBuild(rawBlock.build);
  if (build !== undefined) config.build = build;
  if (rawBlock.outputs !== undefined) {
    config.outputs = asRecord(rawBlock.outputs, "outputs");
  }
  if (rawBlock.output !== undefined) config.output = rawBlock.output;
  if (rawBlock.claude !== undefined) config.claude = rawBlock.claude;
  if (rawBlock.codex !== undefined) config.codex = rawBlock.codex;
  if (rawBlock.metadata !== undefined) {
    config.metadata = asRecord(rawBlock.metadata, "metadata");
  }
  if (rawBlock.versioning !== undefined) config.versioning = rawBlock.versioning;

  return config;
}

function readYamlFile(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    throw new MarketplaceAuthoringError(
      `Could not read ${path}: ${err instanceof Error ? err.message : String(err)}`,
      1,
    );
  }
  try {
    return loadYamlDocument(text, path);
  } catch (err) {
    if (err instanceof YamlError) {
      throw new MarketplaceAuthoringError(err.message, 2);
    }
    throw err;
  }
}

/**
 * Load marketplace authoring config from `bapm.yml` `marketplace:` block.
 * Inherits top-level name/description/version when omitted in the block.
 */
export function loadMarketplaceFromBapmYml(
  options: LoadMarketplaceFromBapmYmlOptions = {},
): LoadMarketplaceResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const path = resolve(options.path ?? resolve(cwd, "bapm.yml"));
  if (!existsSync(path)) {
    throw new MarketplaceAuthoringError(
      `No bapm.yml at ${path}. Run 'bapm marketplace init' to scaffold one.`,
      1,
    );
  }
  const raw = readYamlFile(path);
  const top = asRecord(raw ?? {}, "bapm.yml");
  if (!("marketplace" in top) || top.marketplace === null || top.marketplace === undefined) {
    throw new MarketplaceAuthoringError(
      "No marketplace config found. Add a 'marketplace:' block to bapm.yml " +
        "or run 'bapm marketplace init' to scaffold one.",
      1,
    );
  }
  const block = asRecord(top.marketplace, "marketplace");
  const config = parseMarketplaceBlock(block, top);
  return { ok: true, config, path, source: "bapm.yml" };
}

/** Load legacy standalone marketplace.yml (top-level marketplace keys). */
export function loadMarketplaceFromLegacyYml(
  options: { cwd?: string; path?: string } = {},
): LoadMarketplaceResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const path = resolve(options.path ?? resolve(cwd, "marketplace.yml"));
  if (!existsSync(path)) {
    throw new MarketplaceAuthoringError(`marketplace.yml not found at ${path}`, 1);
  }
  const raw = readYamlFile(path);
  const top = asRecord(raw ?? {}, "marketplace.yml");
  checkUnknownKeys(top, MARKETPLACE_KEYS, "top level");
  const config = parseMarketplaceBlock(top, {});
  return { ok: true, config, path, source: "marketplace.yml" };
}

export { parseMarketplaceBlock, MARKETPLACE_KEYS, PACKAGE_ENTRY_KEYS };
