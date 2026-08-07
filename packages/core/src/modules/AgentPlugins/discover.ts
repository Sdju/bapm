import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { isWithin, loadAgentPluginManifest } from "./load.ts";
import type {
  AgentPluginDiagnostic,
  AgentPluginSkill,
  DiscoverAgentPluginSkillsOptions,
  DiscoverAgentPluginSkillsResult,
} from "./types.ts";

/**
 * Discover only immediate `skills/<name>/SKILL.md` entries and return complete,
 * containment-checked directories for portable import.
 */
export function discoverAgentPluginSkills(
  options: DiscoverAgentPluginSkillsOptions,
): DiscoverAgentPluginSkillsResult {
  const loaded = loadAgentPluginManifest(options);
  const diagnostics = [...loaded.diagnostics];
  const skillsDir = join(loaded.root, "skills");
  if (!existsSync(skillsDir)) return { ...loaded, diagnostics, skills: [] };

  const resolvedSkillsDir = safelyResolveDirectory(skillsDir, loaded.root);
  if (!resolvedSkillsDir) {
    diagnostics.push(
      diagnostic(
        "AGENT_PLUGIN_SKILLS_INVALID",
        "Ignoring invalid skills component directory",
        skillsDir,
      ),
    );
    return { ...loaded, diagnostics, skills: [] };
  }

  const skills: AgentPluginSkill[] = [];
  for (const entry of readdirSync(resolvedSkillsDir, { withFileTypes: true })) {
    const candidate = join(resolvedSkillsDir, entry.name);
    const directory = safelyResolveDirectory(candidate, loaded.root);
    if (!directory) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        diagnostics.push(
          diagnostic(
            "AGENT_PLUGIN_SKILL_INVALID",
            `Skipping invalid skill "${entry.name}"`,
            candidate,
          ),
        );
      }
      continue; // files and broken/outside symlinks cannot be skills
    }

    const skillPath = join(directory, "SKILL.md");
    const resolvedSkillPath = safelyResolveFile(skillPath, loaded.root);
    if (!resolvedSkillPath) {
      if (existsSync(skillPath)) {
        diagnostics.push(
          diagnostic(
            "AGENT_PLUGIN_SKILL_INVALID",
            `Skipping invalid skill "${entry.name}"`,
            skillPath,
          ),
        );
      }
      continue;
    }
    if (!treeIsContained(directory, loaded.root, new Set())) {
      diagnostics.push(
        diagnostic(
          "AGENT_PLUGIN_SKILL_INVALID",
          `Skipping skill "${entry.name}" because an included path escapes the plugin root`,
          directory,
        ),
      );
      continue;
    }
    skills.push({ name: entry.name, directory, skillPath: resolvedSkillPath });
  }
  return { ...loaded, diagnostics, skills };
}

function safelyResolveDirectory(path: string, root: string): string | undefined {
  try {
    const resolved = realpathSync(path);
    return isWithin(root, resolved) && statSync(resolved).isDirectory() ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function safelyResolveFile(path: string, root: string): string | undefined {
  try {
    const resolved = realpathSync(path);
    return isWithin(root, resolved) && statSync(resolved).isFile() ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function treeIsContained(directory: string, root: string, visited: Set<string>): boolean {
  if (visited.has(directory)) return true;
  visited.add(directory);
  try {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const resolved = realpathSync(path);
      if (!isWithin(root, resolved)) return false;
      const stat = statSync(resolved);
      if (stat.isDirectory() && !treeIsContained(resolved, root, visited)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function diagnostic(code: string, message: string, path: string): AgentPluginDiagnostic {
  return { code, message, path, severity: "warning" };
}
