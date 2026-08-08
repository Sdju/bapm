import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { zipSync } from "fflate";
import { loadManifest, serializeManifest, type BapmManifest } from "@/modules/Manifest";
import { RegistryError } from "./errors.ts";
import type { BuildPublishArchiveOptions, BuildPublishArchiveResult } from "./types.ts";

const OPTIONAL_ROOT_DOCS = ["README.md", "CHANGELOG.md", "LICENSE", "LICENSE.md"];

/**
 * Build flat registry publish zip: `apm.yml` at root + `.apm/**` (+ optional docs).
 * Does NOT call M7 pack product API — zip I/O only via fflate.
 * Never includes personal overlay `bapm.local.yml` (unpublished; not walked from root).
 */
export function buildPublishArchive(
  options: BuildPublishArchiveOptions = {},
): BuildPublishArchiveResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const { document } = loadManifest({ cwd });
  const name = document.name?.trim();
  const version = document.version?.trim();
  if (!name || !name.includes("/")) {
    throw new RegistryError(
      "REGISTRY_PUBLISH",
      `Publish requires package name in owner/repo form; got "${name ?? ""}"`,
    );
  }
  if (!version) {
    throw new RegistryError("REGISTRY_PUBLISH", "Publish requires a non-empty manifest version");
  }
  const slash = name.indexOf("/");
  const owner = name.slice(0, slash);
  const repo = name.slice(slash + 1);
  if (!owner || !repo) {
    throw new RegistryError(
      "REGISTRY_PUBLISH",
      `Publish requires package name in owner/repo form; got "${name}"`,
    );
  }

  const apmDir = join(cwd, ".apm");
  if (!existsSync(apmDir) || !statSync(apmDir).isDirectory()) {
    throw new RegistryError(
      "REGISTRY_PUBLISH",
      "Missing required .apm/ directory for publish (use --zip to upload a prebuilt archive)",
    );
  }

  const files: Record<string, Uint8Array> = {};
  const wireManifest = { ...document } as BapmManifest;
  const yaml = serializeManifest(wireManifest);
  files["apm.yml"] = new TextEncoder().encode(yaml);

  collectDir(apmDir, ".apm", files);

  if (options.includeDocs !== false) {
    for (const doc of OPTIONAL_ROOT_DOCS) {
      const p = join(cwd, doc);
      if (existsSync(p) && statSync(p).isFile()) {
        files[doc] = new Uint8Array(readFileSync(p));
      }
    }
  }

  const bytes = zipSync(files, { level: 6 });
  return { bytes, owner, repo, version, name };
}

function collectDir(absDir: string, zipPrefix: string, out: Record<string, Uint8Array>): void {
  for (const name of readdirSync(absDir)) {
    const abs = join(absDir, name);
    const rel = join(zipPrefix, name).replace(/\\/g, "/");
    if (statSync(abs).isDirectory()) {
      collectDir(abs, rel, out);
    } else {
      out[rel] = new Uint8Array(readFileSync(abs));
    }
  }
}
