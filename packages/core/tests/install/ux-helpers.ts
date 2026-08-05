/**
 * Install UX helpers (dry-run, exclude, positional package-refs).
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createFakePorts,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
  coreRoot,
  writeText as writeTextAbs,
} from "./helpers.ts";

export {
  createFakePorts,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
  coreRoot,
};

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-install-ux-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(cwd: string, relative: string, contents: string): void {
  writeTextAbs(join(cwd, relative), contents);
}

/** Minimal path-dep project with optional .cursor and skill for materialize. */
export function writeLeafProject(
  cwd: string,
  name: string,
  options?: { withCursor?: boolean; withSkill?: boolean },
): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  if (options?.withCursor !== false) {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
  }
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    "utf8",
  );
  writeFileSync(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    "utf8",
  );
  if (options?.withSkill !== false) {
    writeText(
      cwd,
      "leaf/.apm/skills/hello/SKILL.md",
      "---\nname: hello\n---\n# Hello\n",
    );
  }
}

/** Direct MCP stdio + leaf path dep; creates `.cursor/` by default. */
export function writeMcpLeafProject(cwd: string, name: string): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}
version: 0.0.1
dependencies:
  apm:
    - path: ./leaf
  mcp:
    - name: test-stdio-server
      registry: false
      transport: stdio
      command: echo
      args: ["--greeting", "hello"]
`,
    "utf8",
  );
  writeFileSync(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    "utf8",
  );
  writeText(
    cwd,
    "leaf/.apm/skills/hello/SKILL.md",
    "---\nname: hello\n---\n# Hello\n",
  );
}

export function hasLockfile(cwd: string): boolean {
  return existsSync(join(cwd, "bapm.lock.yaml")) || existsSync(join(cwd, "apm.lock.yaml"));
}

export function hasModules(cwd: string): boolean {
  return existsSync(join(cwd, "apm_modules")) || existsSync(join(cwd, "bapm_modules"));
}

export function readManifestText(cwd: string): string {
  const path = existsSync(join(cwd, "bapm.yml"))
    ? join(cwd, "bapm.yml")
    : join(cwd, "apm.yml");
  return readFileSync(path, "utf8");
}

export function manifestExists(cwd: string): boolean {
  return existsSync(join(cwd, "bapm.yml")) || existsSync(join(cwd, "apm.yml"));
}

/**
 * Content fingerprint of durable project paths (atime ignored).
 * Covers manifest, lock, modules, and harness (.cursor / .agents).
 */
export function fingerprintProject(cwd: string): string {
  const roots = [
    "bapm.yml",
    "apm.yml",
    "bapm.lock.yaml",
    "apm.lock.yaml",
    "apm_modules",
    "bapm_modules",
    ".cursor",
    ".agents",
  ];
  const entries: string[] = [];
  for (const root of roots) {
    const abs = join(cwd, root);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (st.isFile()) {
      entries.push(`${root}:${shaBytes(readFileSync(abs))}`);
      continue;
    }
    for (const rel of listFilesRecursive(abs)) {
      const file = join(abs, rel);
      entries.push(`${root}/${rel.replaceAll("\\", "/")}:${shaBytes(readFileSync(file))}`);
    }
  }
  entries.sort();
  return createHash("sha256").update(entries.join("\n"), "utf8").digest("hex");
}

function shaBytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(abs).isDirectory()) walk(abs, rel);
      else out.push(rel);
    }
  };
  walk(root, "");
  return out.sort();
}

export type SpyTarget = {
  target: {
    id: string;
    deployRoots: string[];
    detect: () => boolean;
    materialize: (...args: unknown[]) => Promise<{ deployedFiles: [] }>;
    configureMcp: (...args: unknown[]) => Promise<{ configPath: string; servers: string[] }>;
  };
  materializeCalls: number;
  configureMcpCalls: number;
};

export function createSpyTarget(id = "cursor"): SpyTarget {
  const state = { materializeCalls: 0, configureMcpCalls: 0 };
  const target = {
    id,
    deployRoots: [".agents/skills", ".cursor"],
    detect: () => true,
    materialize: async () => {
      state.materializeCalls += 1;
      return { deployedFiles: [] as [] };
    },
    configureMcp: async () => {
      state.configureMcpCalls += 1;
      return { configPath: ".cursor/mcp.json", servers: ["test-stdio-server"] };
    },
  };
  return {
    target,
    get materializeCalls() {
      return state.materializeCalls;
    },
    get configureMcpCalls() {
      return state.configureMcpCalls;
    },
  };
}

export async function installWithSpy(
  cwd: string,
  options: Record<string, unknown>,
): Promise<{ result: unknown; spy: SpyTarget; ports: ReturnType<typeof createFakePorts> }> {
  const ports = createFakePorts();
  const api = await importTargetApi();
  const registry = getCreateRegistry(api)();
  const spy = createSpyTarget();
  getRegisterTarget(api, registry)(spy.target);
  const runInstall = getRunInstall();
  const result = await runInstall({
    cwd,
    frozen: false,
    targetRegistry: registry,
    registry,
    gitRemote: ports.gitRemote,
    tagLister: ports.tagLister,
    downloader: ports.downloader,
    ...options,
  });
  return { result, spy, ports };
}

export function readInstallTypesSource(): string {
  return readFileSync(join(coreRoot, "src/modules/Install/types.ts"), "utf8");
}
