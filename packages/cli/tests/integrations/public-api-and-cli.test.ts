import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createIntegrationRegistry } from "@bapm/integration-api";
import type { BapmIntegration, IntegrationRegistry } from "@bapm/integration-api";
import { runCli } from "../../src/index.ts";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-integration-vocabulary-"));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

async function withCapturedIo<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; output: string }> {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message?: unknown) => lines.push(String(message));
  console.error = (message?: unknown) => lines.push(String(message));
  try {
    return { result: await fn(), output: lines.join("\n") };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function importExitStatus(source: string): number | null {
  return spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).status;
}

describe("integration vocabulary public API and CLI", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("consumer registers, detects, and retrieves an integration using only renamed API", async () => {
    const registry: IntegrationRegistry = createIntegrationRegistry();
    const integration: BapmIntegration = {
      id: "consumer-editor",
      deployRoots: [".consumer"],
      detect: () => true,
      materialize: async () => ({ deployedFiles: [] }),
    };

    registry.register(integration);

    expect(registry.get("consumer-editor")).toBe(integration);
    expect(registry.list()).toContain(integration);
    await expect(registry.detect("/consumer-project")).resolves.toMatchObject({
      detectedIds: ["consumer-editor"],
    });
  });

  test.each([
    ["BapmTarget", 'import { BapmTarget } from "@bapm/integration-api";'],
    ["TargetRegistry", 'import { TargetRegistry } from "@bapm/integration-api";'],
    ["createTargetRegistry", 'import { createTargetRegistry } from "@bapm/integration-api";'],
    ["createRegistry", 'import { createRegistry } from "@bapm/integration-api";'],
    ["bapm-target-cursor", 'import "bapm-target-cursor";'],
  ])("retired public surface %s fails module loading", (_name, source) => {
    expect(importExitStatus(source)).not.toBe(0);
  });

  test("compile retains manifest target and explicit --target cursor selection", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    mkdirSync(join(project.cwd, ".apm", "instructions"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      "name: integration-vocabulary\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm: []\n",
      "utf8",
    );
    writeFileSync(
      join(project.cwd, ".apm", "instructions", "style.md"),
      "# Consumer style\nKeep responses concise.\n",
      "utf8",
    );

    const { result, output } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["compile", "--target", "cursor"])),
    );

    expect(output).not.toMatch(/unknown (?:flag|option)|unrecognized/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
  });
});
