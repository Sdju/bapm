/**
 * Discover package-root `bin/` files and materialize into a thin deploy root (D3).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

export type DiscoveredBinFile = {
  /** Absolute path to source file under package `bin/`. */
  sourcePath: string;
  /** Basename used at deploy destination. */
  name: string;
};

/**
 * List files directly under `<packageRoot>/bin/` (no recursion outside package root).
 */
export function discoverPackageBinFiles(packageRoot: string): DiscoveredBinFile[] {
  const root = resolve(packageRoot);
  const binDir = join(root, "bin");
  if (!existsSync(binDir) || !statSync(binDir).isDirectory()) return [];

  const out: DiscoveredBinFile[] = [];
  for (const entry of readdirSync(binDir)) {
    const abs = join(binDir, entry);
    if (!isPathInside(root, abs)) continue;
    if (!statSync(abs).isFile()) continue;
    out.push({ sourcePath: abs, name: basename(abs) });
  }
  return out;
}

/**
 * Copy discovered bins into `deployRoot` (created if missing).
 * Returns absolute paths written.
 */
export function materializeBinFiles(args: {
  files: DiscoveredBinFile[];
  deployRoot: string;
}): string[] {
  const deployRoot = resolve(args.deployRoot);
  mkdirSync(deployRoot, { recursive: true });
  const written: string[] = [];
  for (const file of args.files) {
    const dest = join(deployRoot, file.name);
    if (!isPathInside(deployRoot, dest)) continue;
    copyFileSync(file.sourcePath, dest);
    written.push(dest);
  }
  return written;
}

export function defaultBinDeployRoot(cwd: string): string {
  return join(resolve(cwd), ".agents", "bin");
}

function isPathInside(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate));
  if (rel === "") return true;
  if (rel.startsWith("..") || rel.startsWith(sep) || rel.includes(`..${sep}`)) return false;
  // Windows absolute escape
  if (rel.includes(":")) return false;
  return true;
}
