import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { AgentPluginsError } from "./errors.ts";
import { isWithin, loadAgentPluginManifest } from "./load.ts";
import type {
  AgentPluginDiagnostic,
  AgentPluginSkill,
  DiscoverAgentPluginSkillsOptions,
  DiscoverAgentPluginSkillsResult,
} from "./types.ts";

/**
 * Discover portable plugin skills.
 *
 * - Omit `plugin.json` `skills` → conventional immediate `skills/<name>/SKILL.md`.
 * - `"skills": []` → zero skills; shadow diagnostic when conventional entries exist.
 * - Non-empty list → exclusive fail-closed resolution (names / paths / container).
 */
export function discoverAgentPluginSkills(
  options: DiscoverAgentPluginSkillsOptions,
): DiscoverAgentPluginSkillsResult {
  const loaded = loadAgentPluginManifest(options);
  const diagnostics = [...loaded.diagnostics];
  const declared = loaded.manifest.skills;

  if (declared === undefined) {
    const skills = scanConventionalSkills(loaded.root, diagnostics);
    return { ...loaded, diagnostics, skills };
  }

  if (declared.length === 0) {
    const conventional = scanConventionalSkills(loaded.root, []);
    if (conventional.length >= 1) {
      const label = options.packageName ?? loaded.manifest.name ?? loaded.root;
      diagnostics.push({
        code: "AGENT_PLUGIN_SKILLS_EMPTY_SHADOWS",
        message: `Empty "skills" declaration for ${label} shadowed ${conventional.length} conventional skill(s); declare intended skills (or a skills container) or omit the key to restore discovery`,
        path: loaded.manifestPath,
        severity: "warning",
      });
    }
    return { ...loaded, diagnostics, skills: [] };
  }

  const skills = resolveDeclaredSkills({
    root: loaded.root,
    declared,
    diagnostics,
  });
  return { ...loaded, diagnostics, skills };
}

function scanConventionalSkills(
  root: string,
  diagnostics: AgentPluginDiagnostic[],
): AgentPluginSkill[] {
  const skillsDir = join(root, "skills");
  if (!existsSync(skillsDir)) return [];

  const resolvedSkillsDir = safelyResolveDirectory(skillsDir, root);
  if (!resolvedSkillsDir) {
    diagnostics.push(
      diagnostic(
        "AGENT_PLUGIN_SKILLS_INVALID",
        "Ignoring invalid skills component directory",
        skillsDir,
      ),
    );
    return [];
  }

  return collectImmediateSkills(resolvedSkillsDir, root, diagnostics);
}

function collectImmediateSkills(
  resolvedSkillsDir: string,
  root: string,
  diagnostics: AgentPluginDiagnostic[],
): AgentPluginSkill[] {
  const skills: AgentPluginSkill[] = [];
  for (const entry of readdirSync(resolvedSkillsDir, { withFileTypes: true })) {
    const candidate = join(resolvedSkillsDir, entry.name);
    const skill = tryReadSkillDirectory(candidate, entry.name, root, diagnostics);
    if (skill) skills.push(skill);
  }
  return skills;
}

function tryReadSkillDirectory(
  candidate: string,
  name: string,
  root: string,
  diagnostics: AgentPluginDiagnostic[],
): AgentPluginSkill | undefined {
  const directory = safelyResolveDirectory(candidate, root);
  if (!directory) {
    try {
      if (existsSync(candidate) && (statSync(candidate).isDirectory() || true)) {
        // Only warn for directory/symlink candidates; plain files are silent skips.
        const st = existsSync(candidate) ? statSync(candidate) : undefined;
        if (st?.isDirectory() || (st && !st.isFile())) {
          diagnostics.push(
            diagnostic("AGENT_PLUGIN_SKILL_INVALID", `Skipping invalid skill "${name}"`, candidate),
          );
        }
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }

  const skillPath = join(directory, "SKILL.md");
  const resolvedSkillPath = safelyResolveFile(skillPath, root);
  if (!resolvedSkillPath) {
    if (existsSync(skillPath)) {
      diagnostics.push(
        diagnostic("AGENT_PLUGIN_SKILL_INVALID", `Skipping invalid skill "${name}"`, skillPath),
      );
    }
    return undefined;
  }
  if (!treeIsContained(directory, root, new Set())) {
    diagnostics.push(
      diagnostic(
        "AGENT_PLUGIN_SKILL_INVALID",
        `Skipping skill "${name}" because an included path escapes the plugin root`,
        directory,
      ),
    );
    return undefined;
  }
  return { name: basename(directory), directory, skillPath: resolvedSkillPath };
}

function resolveDeclaredSkills(args: {
  root: string;
  declared: string[];
  diagnostics: AgentPluginDiagnostic[];
}): AgentPluginSkill[] {
  const byName = new Map<string, AgentPluginSkill>();

  for (const raw of args.declared) {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) {
      throwDeclared(`Declared skills entry is empty`, trimmed, args.root);
    }

    const normalized = trimmed.replace(/\\/g, "/");
    if (
      normalized.startsWith("/") ||
      /^[A-Za-z]:\//.test(normalized) ||
      normalized.split("/").includes("..") ||
      normalized.includes("\0")
    ) {
      const kind =
        normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)
          ? "absolute"
          : "path traversal";
      throwDeclared(
        `Declared skills entry escapes the plugin root (${kind}): ${trimmed}`,
        trimmed,
        args.root,
      );
    }

    const rel = normalized.replace(/^\.\//, "");
    if (rel === "skills") {
      const skillsDir = join(args.root, "skills");
      const resolvedSkillsDir = safelyResolveDirectory(skillsDir, args.root);
      if (!resolvedSkillsDir) {
        throwDeclared(
          `Declared skills container is missing or invalid: ${trimmed}`,
          trimmed,
          args.root,
        );
      }
      for (const skill of collectImmediateSkills(resolvedSkillsDir, args.root, args.diagnostics)) {
        byName.set(skill.name, skill);
      }
      continue;
    }

    let skillName: string;
    if (!rel.includes("/")) {
      skillName = rel;
    } else if (rel.startsWith("skills/")) {
      const rest = rel.slice("skills/".length);
      if (!rest || rest.includes("/")) {
        throwDeclared(
          `Declared skills path must be a conventional-depth skill under skills/: ${trimmed}`,
          trimmed,
          args.root,
        );
      }
      skillName = rest;
    } else {
      throwDeclared(
        `Declared skills entry must be a skill name, skills/<name>, or skills container: ${trimmed}`,
        trimmed,
        args.root,
      );
    }

    const candidate = join(args.root, "skills", skillName);
    const skill = tryReadSkillDirectory(candidate, skillName, args.root, []);
    if (!skill) {
      throwDeclared(`Declared skill is missing or invalid: ${trimmed}`, trimmed, args.root);
    }
    byName.set(skill.name, skill);
  }

  return [...byName.values()];
}

function throwDeclared(message: string, path: string, root: string): never {
  throw new AgentPluginsError("AGENT_PLUGIN_SKILL_DECLARED_INVALID", message, {
    field: "skills",
    path,
    root,
  });
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
