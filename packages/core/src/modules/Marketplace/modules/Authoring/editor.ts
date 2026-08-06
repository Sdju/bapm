import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { stringify } from "yaml";
import { loadYamlDocument } from "@/common/yaml/loadDocument.ts";
import { MarketplaceAuthoringError } from "./errors.ts";
import { loadMarketplaceFromBapmYml } from "./load.ts";
import {
  githubHttpsUrlFromOwnerRepo,
  isGithubOwnerRepoShorthand,
  isLocalAuthoringSource,
  splitHostFromAuthoringSource,
  validateMarketplaceAuthoringSource,
} from "./source.ts";
import type {
  AuthoringPackageEditOptions,
  AuthoringPackageRemoveOptions,
  EditorResult,
} from "./types.ts";

function resolveBapmPath(options: { cwd?: string; path?: string }): { cwd: string; path: string } {
  const cwd = resolve(options.cwd ?? process.cwd());
  const path = resolve(options.path ?? resolve(cwd, "bapm.yml"));
  return { cwd, path };
}

function readDoc(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    throw new MarketplaceAuthoringError(
      `No bapm.yml at ${path}. Run 'bapm marketplace init' first.`,
      1,
    );
  }
  const raw = loadYamlDocument(readFileSync(path, "utf8"), path);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new MarketplaceAuthoringError("bapm.yml root must be a mapping", 2);
  }
  return raw as Record<string, unknown>;
}

function ensureMarketplaceBlock(doc: Record<string, unknown>): Record<string, unknown> {
  if (!("marketplace" in doc) || doc.marketplace === null || doc.marketplace === undefined) {
    throw new MarketplaceAuthoringError(
      "No marketplace: block in bapm.yml. Run 'bapm marketplace init' first.",
      1,
    );
  }
  if (typeof doc.marketplace !== "object" || Array.isArray(doc.marketplace)) {
    throw new MarketplaceAuthoringError("'marketplace' must be a mapping", 2);
  }
  return doc.marketplace as Record<string, unknown>;
}

function packagesList(block: Record<string, unknown>): Record<string, unknown>[] {
  if (block.packages === undefined || block.packages === null) {
    block.packages = [];
  }
  if (!Array.isArray(block.packages)) {
    throw new MarketplaceAuthoringError("'marketplace.packages' must be a list", 2);
  }
  return block.packages as Record<string, unknown>[];
}

function atomicWrite(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, path);
}

function writeWithRestore(path: string, nextContents: string, validate: () => void): void {
  const previous = readFileSync(path, "utf8");
  const backup = `${path}.bapm-bak`;
  copyFileSync(path, backup);
  try {
    atomicWrite(path, nextContents);
    validate();
    try {
      unlinkSync(backup);
    } catch {
      /* ignore */
    }
  } catch (err) {
    try {
      writeFileSync(path, previous, "utf8");
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(backup);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

function serializeDoc(doc: Record<string, unknown>): string {
  return stringify(doc, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  });
}

function parseTags(tags: string[] | string | undefined): string[] | undefined {
  if (tags === undefined) return undefined;
  if (Array.isArray(tags)) return tags.map(String);
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function failResult(error: string): EditorResult {
  return { ok: false, error };
}

function verifyGithubSync(source: string, ref?: string): void {
  const url = githubHttpsUrlFromOwnerRepo(source);
  const args = ref ? ["ls-remote", url, ref] : ["ls-remote", url, "HEAD"];
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new MarketplaceAuthoringError(
      `git ls-remote failed for '${source}' (unreachable / not found): ${(result.stderr || result.stdout || `exit ${result.status}`).trim()}`,
      2,
    );
  }
}

function maybeVerifyOnAdd(options: AuthoringPackageEditOptions, source: string): void {
  if (options.noVerify || isLocalAuthoringSource(source)) return;

  if (isGithubOwnerRepoShorthand(source)) {
    verifyGithubSync(source, options.ref);
    return;
  }

  const { host, repoPath } = splitHostFromAuthoringSource(source);
  if (host === "github.com" || host?.endsWith(".ghe.com")) {
    verifyGithubSync(repoPath, options.ref);
    return;
  }

  console.warn(
    `Warning: online verify unsupported for this host; skipping git ls-remote (use --no-verify to silence).`,
  );
}

/**
 * Add a package entry to bapm.yml marketplace.packages; re-validate after write.
 */
export function addMarketplacePackage(options: AuthoringPackageEditOptions): EditorResult {
  try {
    const { cwd, path } = resolveBapmPath(options);
    if (!options.name?.trim()) return failResult("package name is required");
    if (!options.source?.trim()) return failResult("package source is required");

    const version = options.version;
    const ref = options.ref;
    if (version !== undefined && ref !== undefined) {
      return failResult("Do not set both --version and --ref (mutually exclusive)");
    }

    const source = options.source.trim();
    const sourceCheck = validateMarketplaceAuthoringSource(source);
    if (!sourceCheck.ok) return failResult(sourceCheck.error);

    maybeVerifyOnAdd(options, source);

    const doc = readDoc(path);
    const block = ensureMarketplaceBlock(doc);
    const list = packagesList(block);
    if (list.some((p) => String(p.name) === options.name.trim())) {
      return failResult(`Package '${options.name.trim()}' already exists`);
    }

    const entry: Record<string, unknown> = {
      name: options.name.trim(),
      source,
    };
    if (version !== undefined) entry.version = version;
    if (ref !== undefined) entry.ref = ref;
    if (options.subdir !== undefined) entry.subdir = options.subdir;
    const tagPattern = options.tagPattern ?? options.tag_pattern;
    if (tagPattern !== undefined) entry.tag_pattern = tagPattern;
    const includePrerelease = options.includePrerelease ?? options.include_prerelease;
    if (includePrerelease !== undefined) entry.include_prerelease = includePrerelease;
    const tags = parseTags(options.tags);
    if (tags) entry.tags = tags;
    if (options.description !== undefined) entry.description = options.description;
    if (options.category !== undefined) entry.category = options.category;

    list.push(entry);
    writeWithRestore(path, serializeDoc(doc), () => {
      loadMarketplaceFromBapmYml({ cwd, path });
    });
    return { ok: true, path };
  } catch (err) {
    if (err instanceof MarketplaceAuthoringError) return failResult(err.message);
    return failResult(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Update fields on an existing package entry.
 */
export function setMarketplacePackage(options: AuthoringPackageEditOptions): EditorResult {
  try {
    const { cwd, path } = resolveBapmPath(options);
    if (!options.name?.trim()) return failResult("package name is required");

    const version = options.version;
    const ref = options.ref;
    if (version !== undefined && ref !== undefined) {
      return failResult("Do not set both version and ref (mutually exclusive)");
    }

    const doc = readDoc(path);
    const block = ensureMarketplaceBlock(doc);
    const list = packagesList(block);
    const idx = list.findIndex((p) => String(p.name) === options.name.trim());
    if (idx < 0) return failResult(`Package '${options.name.trim()}' not found`);

    const entry = { ...list[idx]! };
    if (options.source !== undefined) {
      const sourceCheck = validateMarketplaceAuthoringSource(options.source.trim());
      if (!sourceCheck.ok) return failResult(sourceCheck.error);
      entry.source = options.source.trim();
    }
    if (version !== undefined) {
      entry.version = version;
      delete entry.ref;
    }
    if (ref !== undefined) {
      entry.ref = ref;
      delete entry.version;
    }
    if (entry.version !== undefined && entry.ref !== undefined) {
      return failResult("Package must not have both version and ref");
    }
    if (options.subdir !== undefined) entry.subdir = options.subdir;
    const tagPattern = options.tagPattern ?? options.tag_pattern;
    if (tagPattern !== undefined) entry.tag_pattern = tagPattern;
    const includePrerelease = options.includePrerelease ?? options.include_prerelease;
    if (includePrerelease !== undefined) entry.include_prerelease = includePrerelease;
    const tags = parseTags(options.tags);
    if (tags) entry.tags = tags;
    if (options.description !== undefined) entry.description = options.description;
    if (options.category !== undefined) entry.category = options.category;

    list[idx] = entry;
    writeWithRestore(path, serializeDoc(doc), () => {
      loadMarketplaceFromBapmYml({ cwd, path });
    });
    return { ok: true, path };
  } catch (err) {
    if (err instanceof MarketplaceAuthoringError) return failResult(err.message);
    return failResult(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Remove a package entry by name.
 */
export function removeMarketplacePackage(options: AuthoringPackageRemoveOptions): EditorResult {
  try {
    const { cwd, path } = resolveBapmPath(options);
    if (!options.name?.trim()) return failResult("package name is required");

    const doc = readDoc(path);
    const block = ensureMarketplaceBlock(doc);
    const list = packagesList(block);
    const idx = list.findIndex((p) => String(p.name) === options.name.trim());
    if (idx < 0) return failResult(`Package '${options.name.trim()}' not found`);

    list.splice(idx, 1);
    writeWithRestore(path, serializeDoc(doc), () => {
      loadMarketplaceFromBapmYml({ cwd, path });
    });
    return { ok: true, path };
  } catch (err) {
    if (err instanceof MarketplaceAuthoringError) return failResult(err.message);
    return failResult(err instanceof Error ? err.message : String(err));
  }
}

export const addAuthoringPackage = addMarketplacePackage;
export const updateAuthoringPackage = setMarketplacePackage;
export const marketplacePackageAdd = addMarketplacePackage;
export const marketplacePackageSet = setMarketplacePackage;
export const marketplacePackageRemove = removeMarketplacePackage;
export const removeAuthoringPackage = removeMarketplacePackage;
