/**
 * marketplace-cli-authoring — init scaffolds marketplace: block.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownMarketplaceSub,
  existsSync,
  hasHostMarketplaceJsonEmit,
  join,
  readText,
  runInProject,
  type TempProject,
  writeText,
} from "./authoring-helpers.ts";

describe("mp-authoring-yml CLI marketplace init", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("init creates marketplace block with owner", async () => {
    project = createTempProject();
    writeText(project.cwd, "bapm.yml", `name: existing\nversion: "0.1.0"\n`);

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "init",
      "--owner",
      "acme-org",
    ]);
    expectKnownMarketplaceSub(combined, "init");
    expect(result).toBe(0);
    const yml = readText(project.cwd, "bapm.yml");
    expect(yml).toMatch(/marketplace:/);
    expect(yml).toMatch(/owner:\s*acme-org/);
    expect(hasHostMarketplaceJsonEmit(project.cwd)).toBe(false);
  });

  test("init without --force refuses existing marketplace block", async () => {
    project = createTempProject();
    const original = [`name: keep`, `marketplace:`, `  owner: keep-org`, `  packages: []`, ``].join(
      "\n",
    );
    writeText(project.cwd, "bapm.yml", original);

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "init",
      "--owner",
      "other-org",
    ]);
    expectKnownMarketplaceSub(combined, "init");
    expect(result).not.toBe(0);
    expect(readText(project.cwd, "bapm.yml")).toBe(original);
  });

  test("init creates stub bapm.yml when missing (--name)", async () => {
    project = createTempProject();
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(false);

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "init",
      "--name",
      "my-mp",
      "--owner",
      "acme-org",
    ]);
    expectKnownMarketplaceSub(combined, "init");
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(true);
    const yml = readText(project.cwd, "bapm.yml");
    expect(yml).toMatch(/name:\s*my-mp/);
    expect(yml).toMatch(/marketplace:/);
    expect(yml).toMatch(/owner:\s*acme-org/);
  });
});
