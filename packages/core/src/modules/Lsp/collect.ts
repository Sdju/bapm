import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadManifest, type BapmManifest } from "@/modules/Manifest";
import { parseLspDeclarations } from "./parse.ts";
import type {
  CollectedLspServer,
  CollectLspServersOptions,
  CollectLspServersResult,
  ParsedLspServer,
} from "./types.ts";

const PROJECT_OWNER = "project:.";
const PACKAGE_OWNER_PREFIX = "package:";

/**
 * Collect LSP server definitions for deploy.
 *
 * Root `dependencies.lsp` and `devDependencies.lsp` are always included.
 * Dependency manifests are included by default (APM parity); the install trust
 * gate still decides whether each dependency-owned server may deploy.
 */
export function collectLspServers(options: CollectLspServersOptions): CollectLspServersResult {
  const root = options.rootManifest;
  const rootName = String(root.name ?? "root");
  const servers: CollectedLspServer[] = [];
  const dependencyPackages = new Set<string>();
  const seen = new Set<string>();

  const add = (
    parsed: ParsedLspServer[],
    origin: CollectedLspServer["origin"],
    packageName: string,
  ): void => {
    for (const entry of parsed) {
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      servers.push({
        ...entry,
        origin,
        packageName,
        owner: origin === "direct" ? PROJECT_OWNER : `${PACKAGE_OWNER_PREFIX}${packageName}`,
      });
      if (origin === "dependency") dependencyPackages.add(packageName);
    }
  };

  add(parseRootLsp(root, rootName), "direct", rootName);

  if (options.includeDependencies !== false) {
    for (const node of options.nodes ?? []) {
      if (!node.packageRoot || !existsSync(node.packageRoot)) continue;
      if (node.depth !== undefined && node.depth < 1) continue;
      let depManifest: BapmManifest;
      try {
        depManifest = loadManifest({ cwd: resolve(node.packageRoot), allowReplace: true }).document;
      } catch {
        continue;
      }
      const depName = String(depManifest.name || node.name || "dependency");
      add(parseRootLsp(depManifest, depName), "dependency", depName);
    }
  }

  return { servers, dependencyPackages: [...dependencyPackages] };
}

function parseRootLsp(manifest: BapmManifest, packageName: string): ParsedLspServer[] {
  return [
    ...parseLspDeclarations(manifest.dependencies?.lsp, { packageName }),
    ...parseLspDeclarations(manifest.devDependencies?.lsp, { packageName }),
  ];
}
