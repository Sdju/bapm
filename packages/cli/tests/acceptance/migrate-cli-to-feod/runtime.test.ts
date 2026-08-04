/**
 * Acceptance: cli-runtime-surface (migrate-cli-to-feod)
 * Preserves public runCli contract and help / version / install / unknown behavior.
 */
import { expect, test } from "vite-plus/test";
import { runCli } from "../../../src/index.ts";

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

test("package root exports async runCli(argv) => Promise<number>", async () => {
  expect(typeof runCli).toBe("function");
  const { result } = await withCapturedIo(() => runCli(["help"]));
  expect(typeof result).toBe("number");
});

test("version subcommand prints name and version with exit 0", async () => {
  const { result, stdout } = await withCapturedIo(() => runCli(["version"]));
  expect(result).toBe(0);
  expect(stdout.join("\n")).toMatch(/^bapm \S+/m);
});

test("version short flag -V succeeds", async () => {
  const { result, stdout } = await withCapturedIo(() => runCli(["-V"]));
  expect(result).toBe(0);
  expect(stdout.join("\n")).toMatch(/bapm \S+/);
});

test("version long flag --version succeeds", async () => {
  const { result, stdout } = await withCapturedIo(() => runCli(["--version"]));
  expect(result).toBe(0);
  expect(stdout.join("\n")).toMatch(/bapm \S+/);
});

test("help subcommand lists help, version, install and exits 0", async () => {
  const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
  const text = stdout.join("\n");
  expect(result).toBe(0);
  expect(text).toMatch(/help/i);
  expect(text).toMatch(/version/i);
  expect(text).toMatch(/install/i);
});

test("default command (empty argv) is help", async () => {
  const { result, stdout } = await withCapturedIo(() => runCli([]));
  const text = stdout.join("\n");
  expect(result).toBe(0);
  expect(text).toMatch(/help/i);
  expect(text).toMatch(/version/i);
  expect(text).toMatch(/install/i);
});

test("help flags -h and --help succeed", async () => {
  for (const flag of ["-h", "--help"] as const) {
    const { result, stdout } = await withCapturedIo(() => runCli([flag]));
    expect(result).toBe(0);
    expect(stdout.join("\n")).toMatch(/install/i);
  }
});

test("install stub fails with not-implemented and manifest/lock names", async () => {
  const { result, stderr } = await withCapturedIo(() => runCli(["install"]));
  const text = stderr.join("\n");
  expect(result).toBe(1);
  expect(text).toMatch(/not implemented/i);
  expect(text).toMatch(/bapm\.yml/);
  expect(text).toMatch(/bapm\.lock\.yaml/);
});

test("unknown command reports error, shows help, exits 1", async () => {
  const { result, stdout, stderr } = await withCapturedIo(() => runCli(["not-a-real-command"]));
  expect(result).toBe(1);
  expect(stderr.join("\n")).toMatch(/not-a-real-command/);
  expect(stdout.join("\n")).toMatch(/install/i);
});
