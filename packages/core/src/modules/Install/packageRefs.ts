import { basename, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  APM_MANIFEST_FILE,
  createMinimalManifest,
  writeProducerManifest,
  type BapmManifest,
  type DependencyEntry,
  type ObjectDependency,
} from "@/modules/Manifest";
import { parseMarketplaceRef, resolveMarketplacePlugin } from "@/modules/Marketplace";
import { classifyDependencyRef } from "@/modules/Resolver";
import { InstallError } from "./errors.ts";

export function normalizeExcludeIds(options: {
  excludeTargets?: string[];
  exclude?: string[];
}): string[] {
  const raw = [...(options.excludeTargets ?? []), ...(options.exclude ?? [])];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    const trimmed = String(id ?? "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function normalizePackageRefs(refs: string[] | undefined): string[] {
  if (!refs || refs.length === 0) return [];
  return refs.map((r) => String(r).trim()).filter(Boolean);
}

/**
 * Convert a CLI/API package-ref string into a manifest `dependencies.apm` entry.
 * Path-like refs become `{ path }`; marketplace/git/registry shorthands stay as strings.
 */
export function packageRefToEntry(ref: string): DependencyEntry {
  let classified;
  try {
    classified = classifyDependencyRef(ref);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new InstallError("INSTALL_PACKAGE_REF", `Invalid package ref "${ref}": ${message}`, {
      cause,
      details: { ref },
    });
  }
  if (classified.kind === "local" && classified.path) {
    return { path: classified.path };
  }
  // Marketplace refs stay as NAME@MARKETPLACE[#ref] strings for graph resolve.
  return ref;
}

/**
 * Pre-resolve marketplace positionals so miss/fetch/unsupported fails before
 * mutating the project manifest (G5 fail-closed).
 */
export async function assertMarketplacePackageRefsResolvable(
  refs: string[],
  opts?: { configDir?: string; marketplaceConfigDir?: string },
): Promise<void> {
  for (const ref of refs) {
    let parsed;
    try {
      parsed = parseMarketplaceRef(ref);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new InstallError("INSTALL_PACKAGE_REF", message, { cause, details: { ref } });
    }
    if (!parsed) continue;
    try {
      await resolveMarketplacePlugin(parsed.pluginName, parsed.marketplaceName, parsed.ref, {
        configDir: opts?.configDir ?? opts?.marketplaceConfigDir,
        marketplaceConfigDir: opts?.marketplaceConfigDir ?? opts?.configDir,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new InstallError("INSTALL_PACKAGE_REF", message, { cause, details: { ref } });
    }
  }
}

function entryMatchesRef(entry: DependencyEntry, ref: string, asEntry: DependencyEntry): boolean {
  if (entry === ref) return true;
  if (typeof entry === "string" && typeof asEntry === "string") {
    return entry === asEntry;
  }
  if (
    typeof entry === "object" &&
    entry !== null &&
    typeof asEntry === "object" &&
    asEntry !== null
  ) {
    const a = entry as ObjectDependency;
    const b = asEntry as ObjectDependency;
    if (a.path && b.path && a.path === b.path) return true;
    if (a.git && b.git && a.git === b.git) return true;
    if (a.id && b.id && a.id === b.id) return true;
  }
  return false;
}

export function appendPackageRefsToManifest(
  document: BapmManifest,
  refs: string[],
  options?: { dev?: boolean },
): { document: BapmManifest; added: string[] } {
  const useDev = options?.dev === true;
  if (useDev) {
    const devDeps = { ...(document.devDependencies ?? {}) };
    const apm = Array.isArray(devDeps.apm) ? [...devDeps.apm] : [];
    const added: string[] = [];
    for (const ref of refs) {
      const entry = packageRefToEntry(ref);
      if (apm.some((existing) => entryMatchesRef(existing, ref, entry))) continue;
      apm.push(entry);
      added.push(ref);
    }
    devDeps.apm = apm;
    return { document: { ...document, devDependencies: devDeps }, added };
  }

  const deps = { ...(document.dependencies ?? {}) };
  const apm = Array.isArray(deps.apm) ? [...deps.apm] : [];
  const added: string[] = [];
  for (const ref of refs) {
    const entry = packageRefToEntry(ref);
    if (apm.some((existing) => entryMatchesRef(existing, ref, entry))) continue;
    apm.push(entry);
    added.push(ref);
  }
  deps.apm = apm;
  return { document: { ...document, dependencies: deps }, added };
}

export function manifestExistsAt(cwd: string): boolean {
  const root = resolve(cwd);
  return existsSync(join(root, "apm.yml")) || existsSync(join(root, "bapm.yml"));
}

/**
 * Auto-create minimal `apm.yml` (APM parity) when neither dual-read brand exists.
 */
export function autoCreateMinimalManifest(cwd: string): {
  document: BapmManifest;
  sourcePath: string;
  sourceFilename: string;
} {
  const root = resolve(cwd);
  const name = basename(root) || "project";
  const document = createMinimalManifest({ name, version: "0.1.0" });
  const sourceFilename = APM_MANIFEST_FILE;
  const sourcePath = join(root, sourceFilename);
  writeProducerManifest(document, { cwd: root, path: sourcePath });
  return { document, sourcePath, sourceFilename };
}

export function writeManifestWithPackageRefs(args: {
  cwd: string;
  document: BapmManifest;
  sourcePath?: string;
  sourceFilename?: string;
  refs: string[];
  /** When true, write under `devDependencies.apm`. */
  dev?: boolean;
}): { document: BapmManifest; added: string[]; sourcePath: string; sourceFilename: string } {
  const { document, added } = appendPackageRefsToManifest(args.document, args.refs, {
    dev: args.dev,
  });
  const written = writeProducerManifest(document, {
    cwd: args.cwd,
    sourcePath: args.sourcePath,
    sourceFilename: args.sourceFilename,
  });
  return {
    document,
    added,
    sourcePath: written.path,
    sourceFilename: args.sourceFilename ?? basename(written.path),
  };
}
