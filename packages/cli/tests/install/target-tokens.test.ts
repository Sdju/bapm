/**
 * Target token parity: published host ids in manifest + legacy alias canonicalisation.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownFlags,
  linkPackageDir,
  runInProject,
  writeText,
  type TempProject,
} from "./helpers.ts";

const PACKAGES_ROOT = join(import.meta.dirname, "..", "..", "..");

function linkHost(projectCwd: string, id: string): string {
  return linkPackageDir(projectCwd, join(PACKAGES_ROOT, `integration-${id}`));
}

function writeProject(
  cwd: string,
  options: {
    name: string;
    target?: string;
    targets?: string[];
    activeTarget?: string;
    withLeafSkill?: boolean;
  },
): void {
  const lines = [`name: ${options.name}`, "version: 0.0.1"];
  if (options.target) lines.push(`target: ${options.target}`);
  if (options.targets) {
    lines.push("targets:");
    for (const id of options.targets) lines.push(`  - ${id}`);
  }
  if (options.activeTarget) {
    lines.push("active:", `  target: ${options.activeTarget}`);
  }
  if (options.withLeafSkill === false) {
    lines.push("dependencies:", "  apm: []");
  } else {
    lines.push("dependencies:", "  apm:", "    - path: ./leaf");
  }
  writeText(cwd, "bapm.yml", `${lines.join("\n")}\n`);

  if (options.withLeafSkill !== false) {
    writeText(cwd, "leaf/apm.yml", "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    writeText(cwd, "leaf/.apm/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");
  }
}

describe("CLI lock · published target tokens", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test.each(["kiro", "grok-bot", "grok-build"] as const)("lock accepts target: %s", async (id) => {
    project = createTempProject("bapm-lock-target-token-");
    writeProject(project.cwd, { name: `lock-${id}`, target: id, withLeafSkill: true });

    const { result, combined } = await runInProject(project.cwd, ["lock"]);

    expectKnownFlags(combined);
    expect(combined).not.toMatch(/Invalid target token/i);
    expect(result).toBe(0);
    expect(
      existsSync(join(project.cwd, "bapm.lock.yaml")) ||
        existsSync(join(project.cwd, "apm.lock.yaml")),
    ).toBe(true);
  });

  test("lock leaves invalid target ids fail-closed", async () => {
    project = createTempProject("bapm-lock-target-invalid-");
    writeProject(project.cwd, { name: "lock-invalid", target: "not-a-host", withLeafSkill: true });

    const { result, combined } = await runInProject(project.cwd, ["lock"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/Invalid target token/i);
    expect(combined).toMatch(/not-a-host/i);
  });
});

describe("CLI install · published target tokens", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("active kiro resolves canonical package and materializes", async () => {
    project = createTempProject("bapm-install-kiro-");
    linkHost(project.cwd, "kiro");
    writeProject(project.cwd, { name: "install-kiro", activeTarget: "kiro" });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expectKnownFlags(combined);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*kiro/i);
    expect(result).toBe(0);
    expect(combined).toMatch(/installed for kiro/);
    expect(existsSync(join(project.cwd, ".kiro", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("--target grok-bot materializes skills into agent-data/workflows", async () => {
    project = createTempProject("bapm-install-grok-bot-");
    linkHost(project.cwd, "grok-bot");
    writeProject(project.cwd, { name: "install-grok-bot", target: "grok-bot" });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "grok-bot",
    ]);

    expectKnownFlags(combined);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*grok-bot/i);
    expect(combined).not.toMatch(/Invalid target token/i);
    expect(result).toBe(0);
    expect(combined).toMatch(/installed for grok-bot/);
    expect(
      existsSync(join(project.cwd, "agent-data", "workflows", "hello", "SKILL.md")),
    ).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello"))).toBe(false);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("active grok-build resolves canonical package and materializes", async () => {
    project = createTempProject("bapm-install-grok-");
    linkHost(project.cwd, "grok-build");
    writeProject(project.cwd, { name: "install-grok", activeTarget: "grok-build" });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expectKnownFlags(combined);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*grok-build/i);
    expect(result).toBe(0);
    expect(combined).toMatch(/installed for grok-build/);
    expect(existsSync(join(project.cwd, ".grok", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("vscode active alias + targets alias install as copilot", async () => {
    project = createTempProject("bapm-install-vscode-alias-");
    linkHost(project.cwd, "copilot");
    writeProject(project.cwd, {
      name: "install-vscode-alias",
      targets: ["vscode"],
      activeTarget: "vscode",
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expectKnownFlags(combined);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*(vscode|copilot)/i);
    expect(result).toBe(0);
    expect(combined).toMatch(/installed for copilot/);
    expect(combined).not.toMatch(/installed for vscode/);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
    expect(readFileSync(join(project.cwd, "bapm.yml"), "utf8")).toMatch(/vscode/);
  });
});
