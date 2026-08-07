import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { MarketplacePackOutputsError } from "./errors.ts";

/**
 * Atomically write marketplace.json (temp + rename) and create parent dirs.
 */
export function atomicWriteMarketplaceJson(absolutePath: string, contents: string): void {
  const dir = dirname(absolutePath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (cause) {
    throw new MarketplacePackOutputsError(
      `Failed to create parent directory for marketplace output: ${dir}`,
      1,
    );
  }

  const tmp = join(dir, `.marketplace-${randomBytes(8).toString("hex")}.tmp`);
  try {
    writeFileSync(tmp, contents, "utf8");
    renameSync(tmp, absolutePath);
  } catch (cause) {
    try {
      writeFileSync(absolutePath, contents, "utf8");
    } catch (fallbackCause) {
      throw new MarketplacePackOutputsError(`Failed to write marketplace.json: ${absolutePath}`, 1);
    }
  }
}
