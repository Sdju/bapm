/**
 * CLI `bapm lock` dual-writes shared + personal lockfiles
 * (promoted from separate-local-lockfile acceptance).
 *
 * Spec: lock-command.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/index.ts";

const PERSONAL_LOCK_FILE = "bapm.local.lock.yaml";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-cli-sep-local-lock-"));
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

describe("CLI lock — personal lock partition", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("lock with local source updates personal lock", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".agents", "local"), { recursive: true });
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      [
        "name: cli-local-lock",
        "version: 0.0.1",
        "dependencies:",
        "  apm:",
        "    - local: true",
        "    - path: ./leaf",
      ].join("\n") + "\n",
      "utf8",
    );
    writeFileSync(
      join(project.cwd, ".agents", "local", "apm.yml"),
      "name: local-pkg\nversion: 0.0.1\ndependencies:\n  apm: []\n",
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n",
      "utf8",
    );
    writeFileSync(join(project.cwd, ".gitignore"), "node_modules/\n", "utf8");

    const { result } = await withCwd(project.cwd, () => withCapturedIo(() => runCli(["lock"])));
    expect(result).toBe(0);

    const hasShared =
      existsSync(join(project.cwd, "bapm.lock.yaml")) ||
      existsSync(join(project.cwd, "apm.lock.yaml"));
    expect(hasShared, "shared lock must exist for path: pin").toBe(true);

    const personalPath = join(project.cwd, PERSONAL_LOCK_FILE);
    expect(existsSync(personalPath), "bapm.local.lock.yaml must contain local pin").toBe(true);
    const personal = readFileSync(personalPath, "utf8");
    expect(personal).toMatch(/local-pkg|local:\.agents\/local|repo_url:\s*local:/i);

    const sharedPath = existsSync(join(project.cwd, "bapm.lock.yaml"))
      ? join(project.cwd, "bapm.lock.yaml")
      : join(project.cwd, "apm.lock.yaml");
    const shared = readFileSync(sharedPath, "utf8");
    expect(shared).toMatch(/leaf/);
    expect(shared).not.toMatch(/local-pkg/);
  });
});
