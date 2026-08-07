/**
 * CLI install UX — help, unknown flags, --target, frozen+update.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/index.ts";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-m5-cli-"));
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

function writeLeafWithCursor(cwd: string, name: string): void {
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
  mkdirSync(join(cwd, "leaf", ".apm", "skills", "hello"), { recursive: true });
  writeFileSync(
    join(cwd, "leaf", ".apm", "skills", "hello", "SKILL.md"),
    "---\nname: hello\n---\n# Hello\n",
    "utf8",
  );
}

describe("CLI install UX", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("install help documents --frozen, --no-frozen, CI default, and --target; not a stub", async () => {
    const viaInstallHelp = await withCapturedIo(() => runCli(["install", "--help"]));
    const viaHelpInstall = await withCapturedIo(() => runCli(["help", "install"]));
    const text = [
      ...viaInstallHelp.stdout,
      ...viaInstallHelp.stderr,
      ...viaHelpInstall.stdout,
      ...viaHelpInstall.stderr,
    ].join("\n");

    // At least one install-help entry must succeed and document the flag subset.
    expect(viaInstallHelp.result === 0 || viaHelpInstall.result === 0).toBe(true);
    expect(text).not.toMatch(/\(stub\)|not implemented/i);
    expect(text).toMatch(/--frozen/);
    expect(text).toMatch(/--no-frozen/);
    expect(text).toMatch(/--target/);
    expect(text).toMatch(/\bCI\b/);
    expect(text).toMatch(/frozen/i);
  });

  test("unknown install flag hard-errors (not soft-ignore)", async () => {
    project = createTempProject();
    writeLeafWithCursor(project.cwd, "unknown-flag");

    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["install", "--not-a-real-flag"])),
    );

    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });

  test("frozen + update rejected at CLI", async () => {
    project = createTempProject();
    writeLeafWithCursor(project.cwd, "frozen-update");

    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["install", "--frozen", "--update"])),
    );

    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/frozen|update/i);
  });

  test("--target cursor forces activation without prior .cursor/", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: force-cli\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    mkdirSync(join(project.cwd, "leaf", ".apm", "skills", "hello"), { recursive: true });
    writeFileSync(
      join(project.cwd, "leaf", ".apm", "skills", "hello", "SKILL.md"),
      "---\nname: hello\n---\n# Hello\n",
      "utf8",
    );
    // deliberately no .cursor/

    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["install", "--target", "cursor"])),
    );

    expect(stderr.join("\n")).not.toMatch(/not implemented|unknown.*flag/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("unknown --target id rejected", async () => {
    project = createTempProject();
    writeLeafWithCursor(project.cwd, "bad-target");

    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["install", "--target", "not-a-host"])),
    );

    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-host|unknown.*target|unregistered/i);
  });

  test("happy path install with .cursor/ deploys skills", async () => {
    project = createTempProject();
    writeLeafWithCursor(project.cwd, "happy-cursor");

    const { result } = await withCwd(project.cwd, () => withCapturedIo(() => runCli(["install"])));

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "apm_modules"))).toBe(true);
    const hasLock =
      existsSync(join(project.cwd, "bapm.lock.yaml")) ||
      existsSync(join(project.cwd, "apm.lock.yaml"));
    expect(hasLock).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });
});
