import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import {
  discoverAgentPluginDeclaredPaths,
  discoverAgentPluginSkills,
  type AgentPluginSkill,
} from "@/modules/AgentPlugins";
import type { PackFileEntry } from "./collect.ts";
import { PackError } from "./errors.ts";

export type PortablePackValidationInput = {
  /** Project / portable plugin root. */
  root: string;
  /** Collected pack set (already filtered by hard excludes and `.bapmignore`). */
  entries: PackFileEntry[];
};

/**
 * Producer-side requirements for a portable Agent Plugins archive.
 *
 * The default pack walk already preserves the whole tree (`commands/`,
 * `hooks/`, `agents/`, `skills/`, root `mcp.json`, native manifests and
 * sibling assets). This guard makes the producer fail closed when a path
 * *declared* by `plugin.json` is missing, escapes the root through traversal
 * or symlinks, or was omitted from the collected set by `.bapmignore` / hard
 * pack rules. Consumer install would otherwise reject the archive it just
 * received.
 */
export function assertPortableAgentPluginPackSet(input: PortablePackValidationInput): void {
  const root = realpathSync(resolve(input.root));
  const packed = new Set(input.entries.map((entry) => realRelative(root, entry.absolutePath)));

  const declared = tryDeclared(() => discoverAgentPluginDeclaredPaths({ root }));
  for (const item of [...declared.commands, ...declared.hooks]) {
    assertPackedFile({
      root,
      packed,
      absolutePath: item.path,
      label: `Declared ${item.type} path "${item.declaredPath}"`,
    });
  }

  if (declared.manifest.skills !== undefined) {
    const discovered = tryDeclared(() => discoverAgentPluginSkills({ root }));
    for (const skill of discovered.skills) {
      assertPackedSkill({ root, packed, skill });
    }
  }
}

function assertPackedSkill(args: {
  root: string;
  packed: Set<string>;
  skill: AgentPluginSkill;
}): void {
  for (const relativePath of filesUnder(args.root, args.skill.directory)) {
    if (!args.packed.has(relativePath)) {
      throw new PackError(
        "PACK_VALIDATION",
        `Declared skill "${args.skill.name}" includes a file that is not in the Agent Plugins pack set: ${relativePath} (check .bapmignore and hard pack rules)`,
        { path: relativePath },
      );
    }
  }
}

function assertPackedFile(args: {
  root: string;
  packed: Set<string>;
  absolutePath: string;
  label: string;
}): void {
  const relativePath = realRelative(args.root, args.absolutePath);
  if (relativePath.startsWith("../") || relativePath === "..") {
    throw new PackError("PACK_VALIDATION", `${args.label} escapes the Agent Plugins root`, {
      path: relativePath,
    });
  }
  if (!args.packed.has(relativePath)) {
    throw new PackError(
      "PACK_VALIDATION",
      `${args.label} is not in the Agent Plugins pack set (excluded by .bapmignore or hard pack rules)`,
      { path: relativePath },
    );
  }
}

/** Recursively list regular files under `dir` as root-relative `/` paths. */
function filesUnder(root: string, dir: string): string[] {
  const files: string[] = [];
  walk(dir, files);
  return files;

  function walk(current: string, out: string[]): void {
    for (const name of readdirSync(current)) {
      const absolute = resolve(current, name);
      const relativePath = realRelative(root, absolute);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        throw new PackError(
          "PACK_VALIDATION",
          `Refusing unsafe symbolic-link Agent Plugins pack entry: ${relativePath}`,
          { path: relativePath },
        );
      }
      if (stat.isDirectory()) {
        walk(absolute, out);
      } else if (stat.isFile()) {
        out.push(relativePath);
      }
    }
  }
}

function realRelative(root: string, absolutePath: string): string {
  let real = absolutePath;
  try {
    real = realpathSync(absolutePath);
  } catch {
    // Keep the caller-provided path; the missing/excluded check reports it.
  }
  return relative(root, real).split(sep).join("/");
}

function tryDeclared<T>(fn: () => T): T {
  try {
    return fn();
  } catch (cause) {
    if (cause instanceof PackError) throw cause;
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new PackError("PACK_VALIDATION", message, { cause });
  }
}
