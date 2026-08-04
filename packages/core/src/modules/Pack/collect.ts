import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { PackError } from "./errors.ts";
import { describeSecretRefuse, isSecretPackPath } from "./secrets.ts";

const EXCLUDED_DIR_NAMES = new Set([".git", "node_modules"]);

export type PackFileEntry = {
  /** Path relative to project root using `/` separators. */
  relativePath: string;
  absolutePath: string;
  bytes: Uint8Array;
};

/**
 * Collect packable project files: manifest, lock, primitives, sources.
 * Excludes `.git`, `node_modules`, and prior `*.zip` artifacts.
 * Fails closed when a secret-pattern path would be included (sc-007).
 */
export function collectPackFiles(cwd: string): PackFileEntry[] {
  const root = resolve(cwd);
  const entries: PackFileEntry[] = [];
  const secrets: string[] = [];

  walk(root, root, entries, secrets);

  if (secrets.length > 0) {
    throw new PackError("PACK_SECRET_REFUSED", describeSecretRefuse(secrets[0]!), {
      path: secrets[0],
      details: { secrets },
    });
  }

  return entries;
}

function walk(root: string, dir: string, out: PackFileEntry[], secrets: string[]): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (cause) {
    throw new PackError("PACK_IO", `Failed to read directory: ${dir}`, { path: dir, cause });
  }

  for (const name of names) {
    if (EXCLUDED_DIR_NAMES.has(name)) continue;
    const abs = join(dir, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      walk(root, abs, out, secrets);
      continue;
    }
    if (!st.isFile()) continue;

    // Prior pack artifacts — do not nest zips.
    if (name.endsWith(".zip")) continue;

    const rel = relative(root, abs).split("\\").join("/");
    if (isSecretPackPath(rel) || isSecretPackPath(name)) {
      secrets.push(rel);
      continue;
    }

    out.push({
      relativePath: rel,
      absolutePath: abs,
      bytes: new Uint8Array(readFileSync(abs)),
    });
  }
}

export function assertProjectHasContent(entries: PackFileEntry[]): void {
  const hasManifest = entries.some(
    (e) => e.relativePath === "bapm.yml" || e.relativePath === "apm.yml",
  );
  if (!hasManifest) {
    throw new PackError(
      "PACK_VALIDATION",
      "Pack set must include a dual-read manifest (bapm.yml or apm.yml) at archive root",
    );
  }
}

export function defaultArchiveName(name: string, version: string): string {
  const safeName = name.replace(/[^\w.@+-]+/g, "-");
  const safeVersion = version.replace(/[^\w.@+-]+/g, "-");
  return `${safeName}-${safeVersion}.zip`;
}

export function ensureCwdExists(cwd: string): void {
  if (!existsSync(cwd)) {
    throw new PackError("PACK_IO", `Project directory does not exist: ${cwd}`, { path: cwd });
  }
}
