/**
 * Acceptance helpers for docs-host-happy-path (canonical host load + selection).
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

const HERE = dirname(fileURLToPath(import.meta.url));
export const PACKAGES_ROOT = join(HERE, "../../../..");
export const REPO_ROOT = join(PACKAGES_ROOT, "..");
export const DOCS_ROOT = join(REPO_ROOT, "apps/docs");

export function createTempProject(prefix = "bapm-docs-host-happy-path-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

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

export function linkCursorIntegration(projectCwd: string): string {
  return linkPackageDir(projectCwd, join(PACKAGES_ROOT, "integration-cursor"));
}

export function linkClaudeIntegration(projectCwd: string): string {
  return linkPackageDir(projectCwd, join(PACKAGES_ROOT, "integration-claude"));
}

async function withCapturedIo<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (msg?: unknown) => {
    stdout.push(String(msg));
  };
  console.error = (msg?: unknown) => {
    stderr.push(String(msg));
  };
  try {
    const result = await fn();
    return { result, stdout, stderr };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(prev);
  }
}

export async function runInProject(
  cwd: string,
  argv: string[],
  env: Record<string, string | undefined> = {},
): Promise<{ result: number; stdout: string[]; stderr: string[]; combined: string }> {
  const keys = new Set(["CI", ...Object.keys(env)]);
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) {
    saved[k] = process.env[k];
  }
  delete process.env.CI;
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    const { result, stdout, stderr } = await withCwd(cwd, () => withCapturedIo(() => runCli(argv)));
    return {
      result,
      stdout,
      stderr,
      combined: [...stdout, ...stderr].join("\n"),
    };
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Fail if CLI rejected argv as unknown flag (prevents false-green on exit≠0). */
export function expectKnownFlags(combined: string): void {
  if (/unknown (?:install )?(?:flag|option)|unrecognized/i.test(combined)) {
    throw new Error(`CLI rejected argv as unknown flag:\n${combined}`);
  }
}

export function writeText(cwd: string, relative: string, contents: string): void {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function skillPath(cwd: string): string {
  return join(cwd, ".agents", "skills", "hello", "SKILL.md");
}

export function cursorOverrideMarker(cwd: string): string {
  return join(cwd, ".cursor-override", "materialized");
}

export type NoMapProjectOptions = {
  name?: string;
  withCursor?: boolean;
  withClaude?: boolean;
  withLeafSkill?: boolean;
  active?: string[];
  /** Object-map host→package (omit for happy-path-without-map). */
  targets?: Record<string, string>;
  localActive?: string[];
};

/**
 * Minimal project. By default: no `targets:` object-map (canonical fallback under test).
 */
export function writeNoMapProject(cwd: string, options: NoMapProjectOptions = {}): void {
  const name = options.name ?? "docs-host-happy-path";
  const lines: string[] = [`name: ${name}`, "version: 0.0.1"];

  if (options.active?.length) {
    lines.push("active:");
    for (const id of options.active) lines.push(`  - ${id}`);
  }

  if (options.targets && Object.keys(options.targets).length > 0) {
    lines.push("targets:");
    for (const [id, spec] of Object.entries(options.targets)) {
      lines.push(`  ${id}: "${spec}"`);
    }
  }

  if (options.withLeafSkill !== false) {
    lines.push("dependencies:", "  apm:", "    - path: ./leaf");
  } else {
    lines.push("dependencies:", "  apm: []");
  }

  writeText(cwd, "bapm.yml", `${lines.join("\n")}\n`);

  if (options.withCursor) {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
  }
  if (options.withClaude) {
    mkdirSync(join(cwd, ".claude"), { recursive: true });
  }

  if (options.withLeafSkill !== false) {
    writeText(cwd, "leaf/apm.yml", "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    writeText(cwd, "leaf/.apm/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");
  }

  if (options.localActive?.length) {
    const localLines = ["active:", ...options.localActive.map((id) => `  - ${id}`), ""];
    writeText(cwd, "bapm.local.yml", localLines.join("\n"));
  }
}

/**
 * Local path package that claims host id `cursor` but writes an override marker
 * (proves map entry replaced canonical `@bapm/integration-cursor`).
 */
export function plantCursorOverridePackage(
  cwd: string,
  relativeDir = "agents/integration/cursor-override",
): string {
  const dest = join(cwd, relativeDir);
  mkdirSync(dest, { recursive: true });
  writeFileSync(
    join(dest, "package.json"),
    `${JSON.stringify(
      {
        name: "@test/cursor-override",
        version: "0.0.0",
        type: "module",
        main: "./index.mjs",
        exports: { ".": "./index.mjs" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    join(dest, "index.mjs"),
    `import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function createIntegration() {
  return {
    id: "cursor",
    deployRoots: [".cursor-override"],
    detect: ({ cwd }) => {
      const p = join(cwd, ".cursor");
      return existsSync(p) && statSync(p).isDirectory();
    },
    async materialize(primitives, ctx) {
      const cwd = ctx?.cwd ?? process.cwd();
      const marker = join(cwd, ".cursor-override", "materialized");
      mkdirSync(dirname(marker), { recursive: true });
      writeFileSync(marker, "map-override-cursor", "utf8");
      const list = Array.isArray(primitives) ? primitives : (primitives?.primitives ?? []);
      const deployedFiles = [];
      for (const p of list) {
        const name = String(p.name ?? "unnamed");
        const destSkill = join(cwd, ".cursor-override", "skills", name, "SKILL.md");
        mkdirSync(dirname(destSkill), { recursive: true });
        writeFileSync(destSkill, "# " + name + "\\n", "utf8");
        deployedFiles.push({ path: ".cursor-override/skills/" + name + "/SKILL.md", primitive: { name } });
      }
      return { targetId: "cursor", deployedFiles };
    },
  };
}
`,
    "utf8",
  );
  return `./${relativeDir}`;
}

/**
 * Local custom host package (id must match map key).
 */
export function plantCustomHostPackage(
  cwd: string,
  hostId: string,
  relativeDir = "agents/integration/custom-host",
): string {
  const dest = join(cwd, relativeDir);
  mkdirSync(dest, { recursive: true });
  writeFileSync(
    join(dest, "package.json"),
    `${JSON.stringify(
      {
        name: `@test/integration-${hostId}`,
        version: "0.0.0",
        type: "module",
        main: "./index.mjs",
        exports: { ".": "./index.mjs" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    join(dest, "index.mjs"),
    `import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function createIntegration() {
  return {
    id: ${JSON.stringify(hostId)},
    deployRoots: [".custom-host"],
    detect: () => false,
    async materialize(_primitives, ctx) {
      const cwd = ctx?.cwd ?? process.cwd();
      const marker = join(cwd, ".custom-host", "materialized");
      mkdirSync(dirname(marker), { recursive: true });
      writeFileSync(marker, ${JSON.stringify(hostId)}, "utf8");
      return { targetId: ${JSON.stringify(hostId)}, deployedFiles: [] };
    },
  };
}
`,
    "utf8",
  );
  return `./${relativeDir}`;
}

export function readDocs(relativeFromDocsRoot: string): string {
  return readFileSync(join(DOCS_ROOT, relativeFromDocsRoot), "utf8");
}

export function docsExists(relativeFromDocsRoot: string): boolean {
  return existsSync(join(DOCS_ROOT, relativeFromDocsRoot));
}

export { existsSync, join, readFileSync };
