import { isAbsolute, normalize, relative, resolve, sep } from "node:path";
import { MarketplacePackOutputsError } from "./errors.ts";

/** Ensure candidate resolves under project root (path jail). */
export function ensureMarketplacePathWithin(absolutePath: string, projectRoot: string): string {
  const root = resolve(projectRoot);
  const target = resolve(absolutePath);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new MarketplacePackOutputsError(
      `Marketplace output path escapes project root (path jail): ${absolutePath}`,
    );
  }
  // Reject weird normalized escapes that slipped through on some platforms
  const norm = normalize(target);
  if (!norm.startsWith(root + sep) && norm !== root) {
    throw new MarketplacePackOutputsError(
      `Marketplace output path escapes project root (path jail): ${absolutePath}`,
    );
  }
  return target;
}
