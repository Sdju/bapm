/**
 * `compile --clean`: remove orphaned generated compile outputs.
 *
 * A candidate is removed only when all of the following hold:
 * - it has one of the selected targets' output shapes (basename and prefix);
 * - it is not part of this invocation's planned output set;
 * - it carries exactly one canonical Build ID line;
 * - the Build ID still matches the normalized content.
 *
 * Hand-authored files (no Build ID) and generated files edited since the last
 * compile (invalid Build ID) are never deleted.
 */

import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { hasBuildIdLine, hasValidBuildId } from "@b-apm/integration-api";
import type { CompileCleanResult, CompileCleanSkip } from "./types.ts";

const CONTROL_DIRS = new Set([".git", "node_modules", "apm_modules", "bapm_modules"]);

export type CompileOutputShape = {
  /** Project-relative directory prefix; empty means any directory. */
  dir: string;
  basename: string;
};

export function toPosixRel(path: string): string {
  return String(path ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

/** Derive a cleanup shape from a target-owned default output path. */
export function outputShapeFromPath(path: string): CompileOutputShape | undefined {
  const rel = toPosixRel(path);
  if (!rel) return undefined;
  const slash = rel.lastIndexOf("/");
  const dir = slash === -1 ? "" : rel.slice(0, slash);
  const basename = slash === -1 ? rel : rel.slice(slash + 1);
  if (!basename) return undefined;
  return { dir: dir === "." ? "" : dir, basename };
}

function matchesShape(path: string, shape: CompileOutputShape): boolean {
  const rel = toPosixRel(path);
  const slash = rel.lastIndexOf("/");
  const dir = slash === -1 ? "" : rel.slice(0, slash);
  const basename = slash === -1 ? rel : rel.slice(slash + 1);
  if (basename !== shape.basename) return false;
  if (shape.dir === "") return true;
  return dir === shape.dir || dir.startsWith(`${shape.dir}/`);
}

function walkProject(cwd: string): string[] {
  const files: string[] = [];
  const walk = (absDir: string, relDir: string): void => {
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      // Never follow symlinks for cleanup candidates.
      if (entry.isSymbolicLink()) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const abs = join(absDir, entry.name);
      if (entry.isDirectory()) {
        if (CONTROL_DIRS.has(entry.name)) continue;
        walk(abs, rel);
        continue;
      }
      if (entry.isFile()) files.push(rel);
    }
  };
  walk(resolve(cwd), "");
  return files;
}

/**
 * Remove (or preview) orphaned generated outputs matching the selected hosts.
 * `keep` is this invocation's planned output set (project-relative paths).
 */
export function cleanCompileOutputs(args: {
  cwd: string;
  shapes: CompileOutputShape[];
  keep: string[];
  dryRun: boolean;
}): CompileCleanResult {
  const shapes = dedupeShapes(args.shapes);
  const keep = new Set(args.keep.map(toPosixRel));
  const removed: string[] = [];
  const wouldRemove: string[] = [];
  const skipped: CompileCleanSkip[] = [];
  if (shapes.length === 0) return { removed, wouldRemove, skipped };

  for (const rel of walkProject(args.cwd)) {
    if (keep.has(rel)) continue;
    if (!shapes.some((shape) => matchesShape(rel, shape))) continue;

    const abs = resolve(args.cwd, rel);
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      skipped.push({ path: rel, reason: "unreadable" });
      continue;
    }

    // No Build ID means hand-authored (or not ours): stay silent and keep it.
    if (!hasBuildIdLine(content)) continue;
    if (!hasValidBuildId(content)) {
      skipped.push({ path: rel, reason: "modified" });
      continue;
    }

    if (args.dryRun) {
      wouldRemove.push(rel);
      continue;
    }
    try {
      rmSync(abs, { force: false });
      removed.push(rel);
    } catch {
      skipped.push({ path: rel, reason: "unlink-failed" });
    }
  }

  return { removed, wouldRemove, skipped };
}

function dedupeShapes(shapes: CompileOutputShape[]): CompileOutputShape[] {
  const seen = new Set<string>();
  const out: CompileOutputShape[] = [];
  for (const shape of shapes) {
    const key = `${shape.dir}\u0000${shape.basename}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(shape);
  }
  return out;
}
