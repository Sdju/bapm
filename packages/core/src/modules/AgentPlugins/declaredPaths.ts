import { basename, resolve } from "node:path";
import { existsSync, realpathSync, statSync } from "node:fs";
import { AgentPluginsError } from "./errors.ts";
import { isWithin, loadAgentPluginManifest } from "./load.ts";
import type {
  AgentPluginDeclaredPath,
  DiscoverAgentPluginDeclaredPathsResult,
  DiscoverAgentPluginSkillsOptions,
} from "./types.ts";

/**
 * Resolve `plugin.json` `commands` / `hooks` path lists under the plugin root.
 * Missing or escaping declared paths fail closed (requirements, not hints).
 */
export function discoverAgentPluginDeclaredPaths(
  options: DiscoverAgentPluginSkillsOptions,
): DiscoverAgentPluginDeclaredPathsResult {
  const loaded = loadAgentPluginManifest(options);
  const commands = resolveDeclaredList({
    root: loaded.root,
    field: "commands",
    type: "command",
    declared: loaded.manifest.commands ?? [],
  });
  const hooks = resolveDeclaredList({
    root: loaded.root,
    field: "hooks",
    type: "hook",
    declared: loaded.manifest.hooks ?? [],
  });
  return { ...loaded, commands, hooks };
}

function resolveDeclaredList(args: {
  root: string;
  field: "commands" | "hooks";
  type: "command" | "hook";
  declared: string[];
}): AgentPluginDeclaredPath[] {
  const out: AgentPluginDeclaredPath[] = [];
  for (const declaredPath of args.declared) {
    const trimmed = String(declaredPath ?? "").trim();
    if (!trimmed) {
      throwDeclared(args.field, `Declared ${args.field} path is empty`, trimmed, args.root);
    }

    // Detect obvious traversal before resolution (../outside-hooks.json).
    const normalized = trimmed.replace(/\\/g, "/");
    if (
      normalized.startsWith("/") ||
      normalized.split("/").includes("..") ||
      normalized.includes("\0")
    ) {
      throwDeclared(
        args.field,
        `Declared ${args.field} path escapes the plugin root (path traversal): ${trimmed}`,
        trimmed,
        args.root,
      );
    }

    const candidate = resolve(args.root, trimmed);
    let resolved: string;
    try {
      if (!existsSync(candidate) || !statSync(candidate).isFile()) {
        throwDeclared(
          args.field,
          `Declared ${args.field} path is missing: ${trimmed}`,
          trimmed,
          args.root,
        );
      }
      resolved = realpathSync(candidate);
    } catch (cause) {
      if (cause instanceof AgentPluginsError) throw cause;
      throwDeclared(
        args.field,
        `Declared ${args.field} path is missing: ${trimmed}`,
        trimmed,
        args.root,
        cause,
      );
    }

    if (!isWithin(args.root, resolved)) {
      throwDeclared(
        args.field,
        `Declared ${args.field} path escapes the plugin root: ${trimmed}`,
        trimmed,
        args.root,
      );
    }

    out.push({
      name: stemForDeclared(resolved, args.type),
      type: args.type,
      path: resolved,
      declaredPath: trimmed,
    });
  }
  return out;
}

function stemForDeclared(filePath: string, type: "command" | "hook"): string {
  const file = basename(filePath);
  if (type === "command") {
    if (/\.prompt\.md$/i.test(file)) return file.replace(/\.prompt\.md$/i, "");
    return file.replace(/\.(md|mdc)$/i, "");
  }
  return file.replace(/\.json$/i, "");
}

function throwDeclared(
  field: "commands" | "hooks",
  message: string,
  path: string,
  root: string,
  cause?: unknown,
): never {
  throw new AgentPluginsError("AGENT_PLUGIN_DECLARED_PATH_INVALID", message, {
    field,
    path,
    root,
    ...(cause !== undefined
      ? { cause: cause instanceof Error ? cause.message : String(cause) }
      : {}),
  });
}
