/**
 * M9 MUST: thin bapm cache info|clean.
 * Specs: cache-cli-ux. Checklist D §16–17.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownFlags,
  runInProject,
  writeModulesCacheProject,
  type TempProject,
} from "../mcp/helpers.ts";

describe("CLI M9 thin cache info|clean", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("bapm cache info after install shows cache root + stats", async () => {
    project = createTempProject();
    writeModulesCacheProject(project.cwd);

    const install = await runInProject(project.cwd, ["install"]);
    expect(install.result).toBe(0);
    expect(existsSync(join(project.cwd, "apm_modules"))).toBe(true);

    const { result, combined } = await runInProject(project.cwd, ["cache", "info"]);
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/unknown command|not implemented/i);
    expect(result).toBe(0);
    expect(combined).toMatch(/apm_modules|cache/i);
    expect(combined).toMatch(/\d+|empty|entries|size|bytes|files/i);
  });

  test("bapm cache clean -y removes modules-cache entries", async () => {
    project = createTempProject();
    writeModulesCacheProject(project.cwd);

    const install = await runInProject(project.cwd, ["install"]);
    expect(install.result).toBe(0);
    expect(readdirSync(join(project.cwd, "apm_modules")).length).toBeGreaterThan(0);

    const { result, combined } = await runInProject(project.cwd, ["cache", "clean", "-y"]);
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/unknown command|not implemented/i);
    expect(result).toBe(0);

    const modules = join(project.cwd, "apm_modules");
    const empty =
      !existsSync(modules) ||
      readdirSync(modules).filter((n) => n !== "." && n !== "..").length === 0;
    expect(empty).toBe(true);
  });

  test("bapm cache clean without -y does not silent-delete", async () => {
    project = createTempProject();
    writeModulesCacheProject(project.cwd);

    const install = await runInProject(project.cwd, ["install"]);
    expect(install.result).toBe(0);
    const before = readdirSync(join(project.cwd, "apm_modules")).length;
    expect(before).toBeGreaterThan(0);

    const { result, combined } = await runInProject(project.cwd, ["cache", "clean"]);
    expectKnownFlags(combined);
    // Non-interactive refuse or confirm prompt — must not wipe silently on success alone.
    if (result === 0 && !/confirm|abort|refus|cancel|require.*-y|yes/i.test(combined)) {
      const after = existsSync(join(project.cwd, "apm_modules"))
        ? readdirSync(join(project.cwd, "apm_modules")).length
        : 0;
      expect(after).toBe(before);
    }
  });
});
