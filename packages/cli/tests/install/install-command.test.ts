/**
 * CLI install happy path and --frozen.
 * Help lists install (runtime.test.ts); lock no-deploy (lock/lock-command.test.ts).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/index.ts";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-cli-install-"));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
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

describe("CLI install", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("bapm install happy path — exit 0, modules + lock", async () => {
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

  test("bapm install --frozen missing lock fails before mutation", async () => {
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

  test("bapm install --frozen with valid lock does not rewrite lock bytes", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-frozen-ok");
    // First produce a lock via `lock` (M3), then frozen install must preserve bytes
    const lockResult = await withCwd(project.cwd, () => withCapturedIo(() => runCli(["lock"])));
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
});
