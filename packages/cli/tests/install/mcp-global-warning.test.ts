/**
 * CLI install surfaces user-global MCP writes for Copilot/Windsurf and keeps
 * `--exclude` as the explicit opt-out.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  PACKAGES_ROOT,
  createTempProject,
  linkCursorIntegration,
  linkPackageDir,
  runInProject,
  writeText,
  type TempProject,
} from "./canonical-host-helpers.ts";

function writeMcpProject(
  cwd: string,
  name: string,
  options: { target?: string; active?: string[] },
): void {
  const lines = [`name: ${name}`, "version: 0.0.1"];
  if (options.target) lines.push(`target: ${options.target}`);
  if (options.active?.length === 1) lines.push("active:", `  target: ${options.active[0]}`);
  if (options.active && options.active.length > 1) {
    lines.push("active:", "  target:", ...options.active.map((id) => `    - ${id}`));
  }
  lines.push(
    "dependencies:",
    "  apm: []",
    "  mcp:",
    "    - name: shared-server",
    "      transport: stdio",
    "      command: echo",
    "",
  );
  writeText(cwd, "bapm.yml", `${lines.join("\n")}\n`);
}

function warningLines(stderr: string[]): string[] {
  return stderr.filter((line) => /MCP config for ".+" was written to/.test(line));
}

describe("CLI install · user-global MCP warning", () => {
  let project: TempProject | undefined;
  let home: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    home?.cleanup();
    project = undefined;
    home = undefined;
  });

  test("copilot warns once with the COPILOT_HOME path", async () => {
    project = createTempProject("bapm-cli-global-copilot-");
    home = createTempProject("bapm-cli-global-copilot-home-");
    linkPackageDir(project.cwd, join(PACKAGES_ROOT, "integration-copilot"));
    writeMcpProject(project.cwd, "cli-global-copilot", { target: "copilot" });

    const { result, stderr, combined } = await runInProject(
      project.cwd,
      ["install", "--target", "copilot"],
      { COPILOT_HOME: home.cwd },
    );

    expect(result).toBe(0);
    const warnings = warningLines(stderr);
    expect(warnings).toHaveLength(1);
    const configPath = join(home.cwd, "mcp-config.json");
    expect(warnings[0]).toContain(configPath);
    expect(combined).toContain("shared by every project");
    expect(combined).toContain("--exclude copilot,windsurf");
    expect(existsSync(configPath)).toBe(true);
  });

  test("windsurf warns once with the CODEIUM_HOME path", async () => {
    project = createTempProject("bapm-cli-global-windsurf-");
    home = createTempProject("bapm-cli-global-windsurf-home-");
    linkPackageDir(project.cwd, join(PACKAGES_ROOT, "integration-windsurf"));
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });
    writeMcpProject(project.cwd, "cli-global-windsurf", { target: "windsurf" });

    const { result, stderr, combined } = await runInProject(
      project.cwd,
      ["install", "--target", "windsurf"],
      { CODEIUM_HOME: home.cwd },
    );

    expect(result).toBe(0);
    const warnings = warningLines(stderr);
    expect(warnings).toHaveLength(1);
    const configPath = join(home.cwd, "windsurf", "mcp_config.json");
    expect(warnings[0]).toContain(configPath);
    expect(combined).toContain("shared by every project");
    expect(existsSync(configPath)).toBe(true);
  });

  test("--exclude copilot,windsurf suppresses configure and the warning", async () => {
    project = createTempProject("bapm-cli-global-exclude-");
    home = createTempProject("bapm-cli-global-exclude-home-");
    linkPackageDir(project.cwd, join(PACKAGES_ROOT, "integration-copilot"));
    linkPackageDir(project.cwd, join(PACKAGES_ROOT, "integration-windsurf"));
    writeMcpProject(project.cwd, "cli-global-exclude", {
      active: ["copilot", "windsurf"],
    });

    const { result, stderr, combined } = await runInProject(
      project.cwd,
      ["install", "--exclude", "copilot,windsurf"],
      { COPILOT_HOME: home.cwd, CODEIUM_HOME: home.cwd },
    );

    expect(result).toBe(0);
    expect(warningLines(stderr)).toHaveLength(0);
    expect(combined).not.toContain("shared by every project");
    expect(combined).toMatch(/Skipping configureMcp for excluded target "copilot"/);
    expect(combined).toMatch(/Skipping configureMcp for excluded target "windsurf"/);
    expect(existsSync(join(home.cwd, "mcp-config.json"))).toBe(false);
    expect(existsSync(join(home.cwd, "windsurf", "mcp_config.json"))).toBe(false);
  });

  test("project-scoped cursor install does not emit the warning", async () => {
    project = createTempProject("bapm-cli-global-cursor-");
    linkCursorIntegration(project.cwd);
    writeMcpProject(project.cwd, "cli-global-cursor", { target: "cursor" });

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "cursor",
    ]);

    expect(result).toBe(0);
    expect(warningLines(stderr)).toHaveLength(0);
    expect(combined).not.toContain("shared by every project");
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(true);
  });
});
