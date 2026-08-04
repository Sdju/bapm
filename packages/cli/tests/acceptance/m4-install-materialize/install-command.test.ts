/**
 * M4 checklist C §21–23 — CLI install happy path, --frozen, lock still no deploy.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../../src/index.ts";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-cli-m4-"));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p.slice(root.length + 1));
    }
  };
  walk(root);
  return out.sort();
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

function writeLeafProject(cwd: string, name: string): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
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
}

describe("M4 CLI install (§21–23)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("bapm install happy path — exit 0, modules + lock (§21)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-install-happy");

    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["install"])),
    );

    expect(stderr.join("\n")).not.toMatch(/not implemented/i);
    expect(result).toBe(0);
    const hasLock =
      existsSync(join(project.cwd, "bapm.lock.yaml")) ||
      existsSync(join(project.cwd, "apm.lock.yaml"));
    expect(hasLock).toBe(true);
    expect(existsSync(join(project.cwd, "apm_modules"))).toBe(true);
  });

  test("bapm install --frozen missing lock fails before mutation (§22)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-frozen-nolock");

    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["install", "--frozen"])),
    );

    const err = stderr.join("\n");
    expect(err).not.toMatch(/not implemented/i);
    expect(result).not.toBe(0);
    expect(err).toMatch(/frozen|lock/i);
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
  });

  test("bapm install --frozen with valid lock does not rewrite lock bytes (§22)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-frozen-ok");
    // First produce a lock via `lock` (M3), then frozen install must preserve bytes
    const lockResult = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["lock"])),
    );
    expect(lockResult.result).toBe(0);
    const lockFile = existsSync(join(project.cwd, "bapm.lock.yaml"))
      ? join(project.cwd, "bapm.lock.yaml")
      : join(project.cwd, "apm.lock.yaml");
    const before = readFileSync(lockFile);

    const { result } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["install", "--frozen"])),
    );
    expect(result).toBe(0);
    expect(Buffer.compare(readFileSync(lockFile), before)).toBe(0);
  });

  test("help describes real install, not permanent stub (§21 help)", async () => {
    const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
    expect(result).toBe(0);
    const text = stdout.join("\n");
    expect(text).toMatch(/\binstall\b/i);
    expect(text).not.toMatch(/install\s+.*\(stub\)/i);
  });

  test("bapm lock still does not deploy harness files (§23)", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });
    mkdirSync(join(project.cwd, ".github", "instructions"), { recursive: true });
    writeFileSync(join(project.cwd, ".agents", "keep.txt"), "x\n", "utf8");
    writeLeafProject(project.cwd, "cli-lock-no-deploy");
    mkdirSync(join(project.cwd, "leaf", ".apm", "skills", "x"), { recursive: true });
    writeFileSync(
      join(project.cwd, "leaf", ".apm", "skills", "x", "SKILL.md"),
      "---\nname: x\n---\n# X\n",
      "utf8",
    );

    const beforeAgents = listFilesRecursive(join(project.cwd, ".agents"));
    const beforeGh = listFilesRecursive(join(project.cwd, ".github"));

    await withCwd(project.cwd, () => withCapturedIo(() => runCli(["lock"])));

    expect(listFilesRecursive(join(project.cwd, ".agents"))).toEqual(beforeAgents);
    expect(listFilesRecursive(join(project.cwd, ".github"))).toEqual(beforeGh);
  });
});
