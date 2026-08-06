import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { loadYamlDocument } from "@/common/yaml/loadDocument.ts";
import { MarketplaceAuthoringError } from "./errors.ts";
import { renderMarketplaceBlock } from "./initTemplate.ts";
import { loadMarketplaceFromBapmYml } from "./load.ts";

export type InitMarketplaceAuthoringOptions = {
  cwd?: string;
  path?: string;
  owner?: string;
  name?: string;
  force?: boolean;
};

export type InitMarketplaceAuthoringResult =
  | { ok: true; path: string; createdManifest: boolean }
  | { ok: false; error: string };

/**
 * Scaffold or overwrite `marketplace:` in bapm.yml. Creates stub manifest if missing.
 */
export function initMarketplaceAuthoring(
  options: InitMarketplaceAuthoringOptions = {},
): InitMarketplaceAuthoringResult {
  try {
    const cwd = resolve(options.cwd ?? process.cwd());
    const path = resolve(options.path ?? resolve(cwd, "bapm.yml"));
    const owner = options.owner?.trim() || "acme-org";
    const projectName = options.name?.trim() || "my-marketplace";
    const force = Boolean(options.force);

    let createdManifest = false;
    let doc: Record<string, unknown>;

    if (!existsSync(path)) {
      createdManifest = true;
      doc = {
        name: projectName,
        version: "0.1.0",
        description: "A short description of what your marketplace offers",
      };
    } else {
      const raw = loadYamlDocument(readFileSync(path, "utf8"), path);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new MarketplaceAuthoringError("bapm.yml root must be a mapping", 2);
      }
      doc = raw as Record<string, unknown>;
      if (doc.marketplace !== undefined && doc.marketplace !== null && !force) {
        return {
          ok: false,
          error:
            "bapm.yml already has a 'marketplace:' block. Pass --force to overwrite.",
        };
      }
    }

    // Parse template into a marketplace mapping via YAML load of fragment.
    const fragment = renderMarketplaceBlock({ owner, name: projectName, cwd });
    const fragmentDoc = loadYamlDocument(fragment, "marketplace-template");
    if (!fragmentDoc || typeof fragmentDoc !== "object" || Array.isArray(fragmentDoc)) {
      throw new MarketplaceAuthoringError("Failed to render marketplace template", 2);
    }
    const block = (fragmentDoc as Record<string, unknown>).marketplace;
    if (!block || typeof block !== "object") {
      throw new MarketplaceAuthoringError("Template missing marketplace mapping", 2);
    }
    doc.marketplace = block;

    mkdirSync(dirname(path), { recursive: true });
    const yaml = stringify(doc, {
      lineWidth: 0,
      defaultStringType: "PLAIN",
      defaultKeyType: "PLAIN",
    });
    const tmp = `${path}.${process.pid}.init.tmp`;
    writeFileSync(tmp, yaml, "utf8");
    renameSync(tmp, path);

    loadMarketplaceFromBapmYml({ cwd, path });
    return { ok: true, path, createdManifest };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
