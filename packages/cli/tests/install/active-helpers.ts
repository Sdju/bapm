/**
 * CLI helpers for manifest `active` selection suites
 * (promoted from manifest-active-targets acceptance).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTempProject, runInProject, writeText, type TempProject } from "./helpers.ts";
import { linkFixturePackage } from "../integrations/map-load-helpers.ts";

export { createTempProject, runInProject, writeText, type TempProject };
export { linkFixturePackage };
export { existsSync, join, readFileSync };

const HERE = dirname(fileURLToPath(import.meta.url));

/** Symlink a workspace package directory into the project's node_modules. */
export function linkPackageDir(projectCwd: string, packageRoot: string): string {
  const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    name: string;
  };
  const name = pkg.name;
  const dest = join(projectCwd, "node_modules", ...name.split("/"));
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  symlinkSync(packageRoot, dest, "dir");
  return name;
}

/** Workspace `@b-apm/integration-cursor` for object-map keys that must include cursor. */
export function linkCursorIntegration(projectCwd: string): string {
  const root = join(HERE, "..", "..", "..", "integration-cursor");
  return linkPackageDir(projectCwd, root);
}

export type ActiveProjectOptions = {
  name?: string;
  active: string[];
  /** Object-map host→package bindings (optional). */
  targets?: Record<string, string>;
  /** Legacy string/array targets preference. */
  legacyTargets?: string[];
  filename?: "bapm.yml" | "apm.yml";
  withLeafSkill?: boolean;
  withInstruction?: boolean;
  /** Create `.cursor/` detect signal (default false — active must drive selection). */
  withCursor?: boolean;
};

export function writeActiveProject(cwd: string, options: ActiveProjectOptions): void {
  const name = options.name ?? "active-root";
  const filename = options.filename ?? "bapm.yml";
  const activeLines = options.active.map((id) => `  - ${id}`).join("\n");

  let targets = options.targets ? { ...options.targets } : undefined;
  if (options.active.includes("cursor") && (!targets || !targets.cursor)) {
    const cursorSpec = linkCursorIntegration(cwd);
    targets = { ...targets, cursor: cursorSpec };
  }

  const lines: string[] = [`name: ${name}`, "version: 0.0.1", "active:", activeLines];

  if (targets) {
    const mapLines = Object.entries(targets)
      .map(([id, spec]) => `  ${id}: "${spec}"`)
      .join("\n");
    lines.push("targets:", mapLines);
  } else if (options.legacyTargets) {
    lines.push("targets:");
    for (const id of options.legacyTargets) {
      lines.push(`  - ${id}`);
    }
  }

  if (options.withLeafSkill) {
    lines.push("dependencies:", "  apm:", "    - path: ./leaf");
  } else {
    lines.push("dependencies:", "  apm: []");
  }

  writeText(cwd, filename, `${lines.join("\n")}\n`);

  if (options.withCursor) {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
  }

  if (options.withLeafSkill) {
    writeText(cwd, "leaf/apm.yml", "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    writeText(cwd, "leaf/.apm/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");
  }

  if (options.withInstruction) {
    writeText(cwd, ".apm/instructions/guide.md", "# Guide\nPrefer short answers.\n");
  }
}

export function acmeMarkerPath(cwd: string): string {
  return join(cwd, ".acme", "materialized");
}

export function acmeCompilePath(cwd: string): string {
  return join(cwd, "ACME.md");
}
