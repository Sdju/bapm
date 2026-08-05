/**
 * p7a-install-project-flags acceptance helpers (core).
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFakePorts,
  expectRejectsMatching,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
  writeText as writeTextAbs,
} from "../../install/helpers.ts";

export {
  createFakePorts,
  expectRejectsMatching,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
};

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../../..");

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-p7a-core-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(cwd: string, relative: string, contents: string): void {
  writeTextAbs(join(cwd, relative), contents);
}

export function writeLeafProject(cwd: string, name: string): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
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
  writeText(
    cwd,
    "leaf/.apm/skills/hello/SKILL.md",
    "---\nname: hello\n---\n# Hello\n",
  );
}

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

export function writePolicy(cwd: string, contents: string): string {
  const path = join(cwd, "bapm-policy.yml");
  writeFileSync(path, contents, "utf8");
  return path;
}

export const BLOCK_DENY_LEAF_POLICY = `name: deny-leaf
enforcement: block
dependencies:
  deny:
    - leaf
`;

export function readInstallTypesSource(): string {
  return readFileSync(join(coreRoot, "src/modules/Install/types.ts"), "utf8");
}

export function readManifestText(cwd: string): string {
  const path = existsSync(join(cwd, "bapm.yml"))
    ? join(cwd, "bapm.yml")
    : join(cwd, "apm.yml");
  return readFileSync(path, "utf8");
}

export function modulesDir(cwd: string): string {
  for (const name of ["apm_modules", "bapm_modules"] as const) {
    const abs = join(cwd, name);
    if (existsSync(abs)) return abs;
  }
  return join(cwd, "apm_modules");
}

export function hasModulesContent(cwd: string): boolean {
  const abs = modulesDir(cwd);
  if (!existsSync(abs)) return false;
  return listFilesRecursive(abs).length > 0;
}

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
      entries.push(`${root}:${sha(readFileSync(abs))}`);
      continue;
    }
    for (const rel of listFilesRecursive(abs)) {
      entries.push(`${root}/${rel}:${sha(readFileSync(join(abs, rel)))}`);
    }
  }
  entries.sort();
  return createHash("sha256").update(entries.join("\n"), "utf8").digest("hex");
}

function sha(buf: Buffer): string {
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
      else out.push(rel.replaceAll("\\", "/"));
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
): Promise<{
  result: unknown;
  spy: SpyTarget;
  ports: ReturnType<typeof createFakePorts>;
}> {
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

/** Direct HTTP dep fixture (scheme http://). */
export function writeDirectHttpProject(
  cwd: string,
  options: { allowInsecure?: boolean; url?: string },
): string {
  const url = options.url ?? "http://mirror.example.com/direct-pkg.git";
  const allow =
    options.allowInsecure === true
      ? "\n      allow_insecure: true"
      : options.allowInsecure === false
        ? "\n      allow_insecure: false"
        : "";
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: p7a-http-direct
version: 0.0.1
dependencies:
  apm:
    - git: ${url}
      ref: main${allow}
`,
    "utf8",
  );
  return url;
}

/**
 * Parent path-dep introduces transitive HTTP child.
 * Gate must see child as transitive (host allowlist applies).
 */
export function writeTransitiveHttpProject(
  cwd: string,
  options?: { childUrl?: string },
): { childUrl: string } {
  const childUrl = options?.childUrl ?? "http://evil.example.com/child.git";
  mkdirSync(join(cwd, "parent"), { recursive: true });
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: p7a-http-transitive
version: 0.0.1
dependencies:
  apm:
    - path: ./parent
`,
    "utf8",
  );
  writeFileSync(
    join(cwd, "parent", "apm.yml"),
    `name: parent
version: 0.0.1
dependencies:
  apm:
    - git: ${childUrl}
      ref: main
`,
    "utf8",
  );
  return { childUrl };
}
