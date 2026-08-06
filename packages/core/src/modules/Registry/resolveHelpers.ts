import { resolve } from "node:path";
import semver from "semver";
import type { RegistryEntry } from "@/modules/Manifest";
import { SafeExtractError, safeExtractZip } from "@/modules/Pack";
import { RegistryError } from "./errors.ts";
import { createRegistryClient, verifyArchiveDigest } from "./createClient.ts";
import type { RegistryClient, RegistryVersionInfo } from "./types.ts";

export type ResolvedRegistryCoords = {
  owner: string;
  repo: string;
  packageId: string;
  baseUrl: string;
  registryName?: string;
};

/**
 * Resolve registry base URL from manifest `registries:` + per-dep name.
 */
export function resolveRegistryBaseUrl(args: {
  registries?: Record<string, RegistryEntry | string>;
  registryName?: string;
  /** Override (tests / CLI). */
  registryBaseUrl?: string;
}): { baseUrl: string; registryName?: string } {
  if (args.registryBaseUrl) {
    return { baseUrl: args.registryBaseUrl.replace(/\/+$/, ""), registryName: args.registryName };
  }
  const regs = args.registries ?? {};
  const named = args.registryName?.trim();
  if (named) {
    const entry = regs[named];
    if (entry === undefined) {
      throw new RegistryError(
        "REGISTRY_CONFIG",
        `Registry "${named}" is not configured in registries: block`,
      );
    }
    return { baseUrl: entryUrl(entry), registryName: named };
  }
  const defaultName = typeof regs.default === "string" ? regs.default : undefined;
  if (!defaultName) {
    throw new RegistryError(
      "REGISTRY_CONFIG",
      "Registry dependency requires registries.default or a per-dep registry: name",
    );
  }
  const entry = regs[defaultName];
  if (entry === undefined) {
    throw new RegistryError(
      "REGISTRY_CONFIG",
      `registries.default refers to missing registry "${defaultName}"`,
    );
  }
  return { baseUrl: entryUrl(entry), registryName: defaultName };
}

function entryUrl(entry: RegistryEntry | string): string {
  if (typeof entry === "string") return entry.replace(/\/+$/, "");
  return String(entry.url).replace(/\/+$/, "");
}

export function parsePackageId(id: string): { owner: string; repo: string } {
  const trimmed = id.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) {
    throw new RegistryError(
      "REGISTRY_CONFIG",
      `Registry package id must be owner/repo; got "${id}"`,
    );
  }
  return { owner: trimmed.slice(0, slash), repo: trimmed.slice(slash + 1) };
}

export function registryRepoUrl(baseUrl: string, packageId: string): string {
  let host = "registry";
  try {
    host = new URL(baseUrl).hostname || host;
  } catch {
    /* keep */
  }
  return `${host}/${packageId}`;
}

export function downloadUrl(baseUrl: string, owner: string, repo: string, version: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/v1/packages/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/versions/${encodeURIComponent(version)}/download`;
}

export function pickRegistryVersion(
  versions: RegistryVersionInfo[],
  constraint: string,
): RegistryVersionInfo {
  const range = constraint.trim().replace(/,/g, " ");
  const matching = versions.filter((v) => {
    try {
      return semver.satisfies(v.version.replace(/^v/, ""), range);
    } catch {
      return v.version === constraint;
    }
  });
  if (matching.length === 0) {
    throw new RegistryError(
      "REGISTRY_CONFIG",
      `No matching registry version for constraint "${constraint}" (empty intersection)`,
    );
  }
  matching.sort((a, b) =>
    semver.rcompare(a.version.replace(/^v/, ""), b.version.replace(/^v/, "")),
  );
  return matching[0]!;
}

export type MaterializeRegistryPackageOptions = {
  cwd: string;
  dest: string;
  bytes: Uint8Array;
  expectedDigest: string;
  label?: string;
};

/**
 * lk-013: verify digest then shared safe-extract into dest. On mismatch, dest is untouched.
 */
export function materializeRegistryArchive(options: MaterializeRegistryPackageOptions): void {
  verifyArchiveDigest(options.bytes, options.expectedDigest, { label: options.label });
  try {
    safeExtractZip(options.bytes, options.dest);
  } catch (cause) {
    if (cause instanceof SafeExtractError) {
      throw new RegistryError("REGISTRY_PUBLISH", cause.message, { cause });
    }
    throw new RegistryError("REGISTRY_PUBLISH", "Failed to extract registry archive", { cause });
  }
}

export async function fetchAndMaterializeRegistry(args: {
  cwd: string;
  baseUrl: string;
  owner: string;
  repo: string;
  version: string;
  expectedDigest: string;
  dest: string;
  client?: RegistryClient;
  /** Alternate fetch URL (rs-009 mirror) — still verify expectedDigest. */
  fetchUrl?: string;
}): Promise<Uint8Array> {
  const client =
    args.client ??
    createRegistryClient({
      baseUrl: args.baseUrl,
    });

  let bytes: Uint8Array;
  if (args.fetchUrl) {
    // Direct GET for mirror URL while still verifying lock hash
    const res = await fetch(args.fetchUrl);
    if (!res.ok) {
      throw new RegistryError(
        "REGISTRY_HTTP",
        `Mirror/registry download failed HTTP ${res.status} for ${args.fetchUrl}`,
        { status: res.status },
      );
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    bytes = await client.download(args.owner, args.repo, args.version);
  }

  materializeRegistryArchive({
    cwd: args.cwd,
    dest: args.dest,
    bytes,
    expectedDigest: args.expectedDigest,
    label: `${args.owner}/${args.repo}@${args.version}`,
  });
  return bytes;
}

export function rewriteDownloadBase(resolvedUrl: string, mirrorBase: string): string {
  // Replace origin of resolved download URL with mirror base, keep path
  try {
    const u = new URL(resolvedUrl);
    const base = mirrorBase.replace(/\/+$/, "");
    return `${base}${u.pathname}${u.search}`;
  } catch {
    return resolvedUrl;
  }
}

export function modulesRegistryDest(cwd: string, packageId: string, version: string): string {
  const safe = packageId.replace(/[^a-zA-Z0-9._/-]+/g, "_");
  return resolve(cwd, "apm_modules", safe, version);
}
