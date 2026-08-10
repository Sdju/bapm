import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/**
 * Runtime package version from `@b-apm/core` package.json (lockstep with CLI releases).
 * Resolves both `src/app/` (tests/dev) and `dist/` (published) layouts.
 */
export function getVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const rel of ["../package.json", "../../package.json", "../../../package.json"]) {
    try {
      const version = (require(join(here, rel)) as { version?: unknown }).version;
      if (typeof version === "string" && version.length > 0) return version;
    } catch {
      // try next candidate
    }
  }
  return "0.0.0";
}
