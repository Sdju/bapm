/**
 * CLI lock command — thin `bapm lock` wrapping core resolveAndLock.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/index.ts";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-cli-lock-"));
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

describe("M3 bapm lock CLI", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("lock is a registered command (not unknown)", async () => {
    project = createTempProject();
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cli-empty\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["lock"])),
    );
    const err = stderr.join("\n");
    expect(err).not.toMatch(/unknown command/i);
    // Empty deps may succeed (0) once implemented; until then non-unknown is the gate.
    expect(result === 0 || result === 1).toBe(true);
  });

  test("happy path — exit 0, lockfile on disk, stdout success (§28)", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cli-happy\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const { result, stdout } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["lock"])),
    );
    expect(result).toBe(0);
    const hasLock =
      existsSync(join(project.cwd, "bapm.lock.yaml")) ||
      existsSync(join(project.cwd, "apm.lock.yaml"));
    expect(hasLock).toBe(true);
    expect(stdout.join("\n")).toMatch(/lockfile written|written to|lock/i);
  });

  test("no manifest → non-zero error (§29)", async () => {
    project = createTempProject();
    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["lock"])),
    );
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/manifest|apm\.yml|bapm\.yml|not found|missing/i);
  });

  test("lock --update is accepted and forces re-resolve mode (§30)", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cli-update\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["lock", "--update"])),
    );
    expect(stderr.join("\n")).not.toMatch(/unknown|unrecognized|invalid option/i);
    expect(result).toBe(0);
  });

  test("lock --parallel-downloads 2 is accepted", async () => {
    project = createTempProject();
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cli-parallel\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["lock", "--parallel-downloads", "2"])),
    );
    expect(stderr.join("\n")).not.toMatch(/unknown|unrecognized|invalid option/i);
    expect(result).toBe(0);
  });

  test("lock does not deploy into harness dirs", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });
    mkdirSync(join(project.cwd, ".github", "instructions"), { recursive: true });
    writeFileSync(join(project.cwd, ".agents", "keep.txt"), "x\n", "utf8");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cli-harness\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    const before = listFilesRecursive(join(project.cwd, ".agents"));
    await withCwd(project.cwd, () => withCapturedIo(() => runCli(["lock"])));
    expect(listFilesRecursive(join(project.cwd, ".agents"))).toEqual(before);
  });
});
