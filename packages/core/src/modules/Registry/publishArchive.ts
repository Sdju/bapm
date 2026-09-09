import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { zipSync } from "fflate";
import { loadBaseManifest, serializeManifest, type BapmManifest } from "@/modules/Manifest";
import { BAPM_PERSONAL_LOCK_FILE } from "@/modules/Lockfile";
import {
  isBapmIgnored,
  isBapmIgnoredDir,
  loadBapmIgnore,
  type BapmIgnoreRules,
} from "@/modules/Pack";
import { RegistryError } from "./errors.ts";
import type { BuildPublishArchiveOptions, BuildPublishArchiveResult } from "./types.ts";

const OPTIONAL_ROOT_DOCS = ["README.md", "CHANGELOG.md", "LICENSE", "LICENSE.md"];

/**
 * Build flat registry publish zip: `apm.yml` at root + `.apm/**` (+ optional docs).
 * Does NOT call M7 pack product API — zip I/O only via fflate.
 * Wire `apm.yml` is serialized from the **dual-read base** only (no `bapm.local.yml` merge).
 * Never includes personal overlay `bapm.local.yml` or personal lock `bapm.local.lock.yaml`.
 * Applies project-root `.bapmignore` to optional docs and `.apm/**` members.
 */
export function buildPublishArchive(
  options: BuildPublishArchiveOptions = {},
): BuildPublishArchiveResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const ignoreRules = loadBapmIgnore(cwd);
  const { document } = loadBaseManifest({ cwd });
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
  // Wire apm.yml is always emitted from the base manifest — never omitted via .bapmignore.
  const wireManifest = { ...document } as BapmManifest;
  const yaml = serializeManifest(wireManifest);
  files["apm.yml"] = new TextEncoder().encode(yaml);

  collectDir(apmDir, ".apm", files, ignoreRules);

  const apmMembers = Object.keys(files).filter((p) => p === ".apm" || p.startsWith(".apm/"));
  if (apmMembers.length === 0) {
    throw new RegistryError(
      "REGISTRY_PUBLISH",
      "Publish archive has no .apm/ files remaining after .bapmignore (empty .apm payload is not allowed)",
    );
  }

  if (options.includeDocs !== false) {
    for (const doc of OPTIONAL_ROOT_DOCS) {
      if (isBapmIgnored(doc, ignoreRules)) continue;
      const p = join(cwd, doc);
      if (existsSync(p) && statSync(p).isFile()) {
        files[doc] = new Uint8Array(readFileSync(p));
      }
    }
  }

  const bytes = zipSync(files, { level: 6 });
  return { bytes, owner, repo, version, name };
}

function collectDir(
  absDir: string,
  zipPrefix: string,
  out: Record<string, Uint8Array>,
  ignoreRules: BapmIgnoreRules,
): void {
  for (const name of readdirSync(absDir)) {
    if (name === BAPM_PERSONAL_LOCK_FILE) continue;
    const abs = join(absDir, name);
    const rel = join(zipPrefix, name).replace(/\\/g, "/");
    if (statSync(abs).isDirectory()) {
      if (isBapmIgnoredDir(rel, ignoreRules)) continue;
      collectDir(abs, rel, out, ignoreRules);
    } else if (!isBapmIgnored(rel, ignoreRules)) {
      out[rel] = new Uint8Array(readFileSync(abs));
    }
  }
}
