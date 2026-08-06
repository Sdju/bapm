import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MarketplaceConfigOptions } from "./types.ts";

const MARKETPLACES_FILENAME = "marketplaces.json";
const CACHE_REL = join("cache", "marketplace");

/** Resolve the bapm config root (`~/.bapm` or injectable override). */
export function getBapmConfigDir(opts?: MarketplaceConfigOptions): string {
  if (opts?.configDir) return opts.configDir;
  return join(homedir(), ".bapm");
}

export function marketplacesJsonPath(opts?: MarketplaceConfigOptions): string {
  return join(getBapmConfigDir(opts), MARKETPLACES_FILENAME);
}

export function marketplaceCacheDir(opts?: MarketplaceConfigOptions): string {
  return join(getBapmConfigDir(opts), CACHE_REL);
}

/** Ensure config root exists (mode 0o700 when newly created). */
export function ensureBapmConfigDir(opts?: MarketplaceConfigOptions): string {
  const dir = getBapmConfigDir(opts);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    try {
      chmodSync(dir, 0o700);
    } catch {
      // Best-effort on platforms that ignore mode.
    }
  }
  return dir;
}
