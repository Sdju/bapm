import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { APM_MODULES_DIR } from "@/modules/Resolver";
import type {
  AttributedPrimitive,
  DiscoverPrimitivesOptions,
  PrimitiveSource,
  PrimitiveType,
} from "./types.ts";

const MANIFEST_NAMES = ["apm.yml", "bapm.yml"] as const;

/**
 * Discover attributed primitives under the project and dependency modules trees.
 */
export function discoverPrimitives(options: DiscoverPrimitivesOptions = {}): AttributedPrimitive[] {
  const cwd = resolve(options.cwd ?? process.cwd());
  const modulesRoot = resolve(options.modulesDir ?? join(cwd, APM_MODULES_DIR));
  const found: AttributedPrimitive[] = [];

  // Local project primitives
  scanPackageRoot(cwd, "local", undefined, found);

  // Dependency packages under modules dir
  if (existsSync(modulesRoot)) {
    for (const pkg of findPackageRoots(modulesRoot)) {
      const name = readPackageName(pkg) ?? basename(pkg);
      const source: PrimitiveSource = `dependency:${name}`;
      scanPackageRoot(pkg, source, name, found);
    }
  }

  return found;
}

function scanPackageRoot(
  root: string,
  source: PrimitiveSource,
  packageName: string | undefined,
  out: AttributedPrimitive[],
): void {
  // Typed .apm/ layouts
  scanTypedApm(join(root, ".apm"), source, packageName, out);

  // Package-root SKILL.md bundle
  const rootSkill = join(root, "SKILL.md");
  if (existsSync(rootSkill) && statSync(rootSkill).isFile()) {
    out.push(
      makePrimitive({
        name: nameFromSkillFile(rootSkill, packageName ?? basename(root)),
        type: "skill",
        source,
        path: rootSkill,
        packageName,
      }),
    );
  }

  // skills/<name>/SKILL.md collection
  const skillsDir = join(root, "skills");
  if (existsSync(skillsDir) && statSync(skillsDir).isDirectory()) {
    for (const entry of safeReaddir(skillsDir)) {
      const skillMd = join(skillsDir, entry, "SKILL.md");
      if (existsSync(skillMd)) {
        out.push(
          makePrimitive({
            name: nameFromSkillFile(skillMd, entry),
            type: "skill",
            source,
            path: skillMd,
            packageName,
          }),
        );
      }
    }
  }

  // Package-root *.prompt.md (APM backward-compatible commands)
  for (const entry of safeReaddir(root)) {
    if (!/\.prompt\.md$/i.test(entry)) continue;
    const full = join(root, entry);
    try {
      if (!statSync(full).isFile()) continue;
    } catch {
      continue;
    }
    out.push(
      makePrimitive({
        name: promptStem(entry),
        type: "command",
        source,
        path: full,
        packageName,
      }),
    );
  }

  // Top-level hooks/*.json (hook-only packages + APM layout)
  scanHooksDir(join(root, "hooks"), source, packageName, out);
}

function scanTypedApm(
  apmDir: string,
  source: PrimitiveSource,
  packageName: string | undefined,
  out: AttributedPrimitive[],
): void {
  if (!existsSync(apmDir) || !statSync(apmDir).isDirectory()) return;

  const typeDirs: Array<{ dir: string; type: PrimitiveType }> = [
    { dir: "skills", type: "skill" },
    { dir: "agents", type: "agent" },
    { dir: "instructions", type: "instruction" },
  ];

  for (const { dir, type } of typeDirs) {
    const typed = join(apmDir, dir);
    if (!existsSync(typed) || !statSync(typed).isDirectory()) continue;
    walkPrimitiveFiles(typed, (filePath) => {
      const name = inferName(filePath, type);
      out.push(
        makePrimitive({
          name,
          type,
          source,
          path: filePath,
          packageName,
        }),
      );
    });
  }

  // .apm/prompts/*.prompt.md → command
  const promptsDir = join(apmDir, "prompts");
  if (existsSync(promptsDir) && statSync(promptsDir).isDirectory()) {
    for (const entry of safeReaddir(promptsDir)) {
      if (!/\.prompt\.md$/i.test(entry)) continue;
      const full = join(promptsDir, entry);
      try {
        if (!statSync(full).isFile()) continue;
      } catch {
        continue;
      }
      out.push(
        makePrimitive({
          name: promptStem(entry),
          type: "command",
          source,
          path: full,
          packageName,
        }),
      );
    }
  }

  // .apm/hooks/*.json → hook
  scanHooksDir(join(apmDir, "hooks"), source, packageName, out);
}

function scanHooksDir(
  hooksDir: string,
  source: PrimitiveSource,
  packageName: string | undefined,
  out: AttributedPrimitive[],
): void {
  if (!existsSync(hooksDir) || !statSync(hooksDir).isDirectory()) return;
  for (const entry of safeReaddir(hooksDir)) {
    if (!/\.json$/i.test(entry)) continue;
    const full = join(hooksDir, entry);
    try {
      if (!statSync(full).isFile()) continue;
    } catch {
      continue;
    }
    out.push(
      makePrimitive({
        name: basename(entry).replace(/\.json$/i, ""),
        type: "hook",
        source,
        path: full,
        packageName,
      }),
    );
  }
}

function walkPrimitiveFiles(dir: string, visit: (file: string) => void): void {
  for (const name of safeReaddir(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      const skillMd = join(full, "SKILL.md");
      if (existsSync(skillMd)) {
        visit(skillMd);
        continue;
      }
      walkPrimitiveFiles(full, visit);
      continue;
    }
    if (st.isFile() && /\.(md|mdc|yml|yaml)$/i.test(name)) {
      visit(full);
    }
  }
}

function findPackageRoots(modulesRoot: string): string[] {
  const roots: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 8) return;
    if (hasManifest(dir)) {
      roots.push(dir);
      return; // don't nest into package internals for further package roots
    }
    for (const name of safeReaddir(dir)) {
      if (name === "node_modules" || name === ".git") continue;
      const full = join(dir, name);
      try {
        if (statSync(full).isDirectory()) walk(full, depth + 1);
      } catch {
        /* ignore */
      }
    }
  };
  walk(modulesRoot, 0);
  return roots;
}

function hasManifest(dir: string): boolean {
  return MANIFEST_NAMES.some((f) => existsSync(join(dir, f)));
}

function readPackageName(pkgRoot: string): string | undefined {
  for (const file of MANIFEST_NAMES) {
    const p = join(pkgRoot, file);
    if (!existsSync(p)) continue;
    try {
      const text = readFileSync(p, "utf8");
      const m = text.match(/^\s*name:\s*["']?([^\s"'#]+)/m);
      if (m) return m[1];
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function nameFromSkillFile(skillMd: string, fallback: string): string {
  try {
    const text = readFileSync(skillMd, "utf8");
    const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
    if (fm) {
      const nameMatch = fm[1]!.match(/^\s*name:\s*["']?([^\s"'#]+)/m);
      if (nameMatch) return nameMatch[1]!;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function inferName(filePath: string, type: PrimitiveType): string {
  if (basename(filePath) === "SKILL.md") {
    return nameFromSkillFile(filePath, basename(dirname(filePath)));
  }
  const file = basename(filePath);
  if (/\.prompt\.md$/i.test(file)) return promptStem(file);
  const base = file.replace(/\.(md|mdc|yml|yaml|json)$/i, "");
  if (base && base !== type) return base;
  return basename(dirname(filePath));
}

/** Stem of `name.prompt.md` → `name` (APM command naming). */
function promptStem(fileName: string): string {
  return basename(fileName).replace(/\.prompt\.md$/i, "");
}

function makePrimitive(p: {
  name: string;
  type: PrimitiveType;
  source: PrimitiveSource;
  path: string;
  packageName?: string;
}): AttributedPrimitive {
  return {
    name: p.name,
    type: p.type,
    source: p.source,
    path: p.path,
    ...(p.packageName ? { packageName: p.packageName } : {}),
  };
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
