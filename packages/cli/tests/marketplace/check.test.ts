/**
 * marketplace-cli-authoring — check --offline / schema fail / online github probe intent.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownMarketplaceSub,
  runInProject,
  type TempProject,
  validAuthoringStub,
  writeText,
} from "./authoring-helpers.ts";

describe("mp-authoring-yml CLI marketplace check", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("check --offline passes valid config", async () => {
    project = createTempProject();
    writeText(project.cwd, "bapm.yml", validAuthoringStub());
    writeText(project.cwd, "plugins/demo/.keep", "");

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "check",
      "--offline",
    ]);
    expectKnownMarketplaceSub(combined, "check");
    expect(result).toBe(0);
  });

  test("check fails on invalid source schema", async () => {
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      [
        `name: acme`,
        `marketplace:`,
        `  owner: acme-org`,
        `  packages:`,
        `    - name: bad`,
        `      source: https://user:pass@github.com/acme/bad`,
        ``,
      ].join("\n"),
    );

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "check",
      "--offline",
    ]);
    expectKnownMarketplaceSub(combined, "check");
    expect(result).not.toBe(0);
  });

  test("online check without --offline attempts github reachability for owner/repo", async () => {
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      [
        `name: acme`,
        `marketplace:`,
        `  owner: acme-org`,
        `  packages:`,
        `    - name: tools`,
        `      source: acme/this-repo-definitely-does-not-exist-zz9`,
        `      ref: main`,
        ``,
      ].join("\n"),
    );

    const { result, combined } = await runInProject(project.cwd, ["marketplace", "check"]);
    expectKnownMarketplaceSub(combined, "check");
    // Must not pretend success without probing; unreachable github shorthand fails.
    expect(result).not.toBe(0);
    expect(combined).toMatch(/ls-remote|unreachable|not found|failed|resolve|git|remote/i);
  });

  test("online check fail-soft warns for non-github host without hard-requiring AuthResolver", async () => {
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      [
        `name: acme`,
        `marketplace:`,
        `  owner: acme-org`,
        `  packages:`,
        `    - name: tools`,
        `      source: gitlab.com/acme/tools`,
        `      ref: main`,
        ``,
      ].join("\n"),
    );

    const { result, combined } = await runInProject(project.cwd, ["marketplace", "check"]);
    expectKnownMarketplaceSub(combined, "check");
    // Schema-valid non-github: warn + schema-only; must not require AuthResolver hard-fail alone.
    expect(combined).toMatch(/unsupported|schema-only|--offline|warning|warn|skip/i);
    expect(combined).not.toMatch(/AuthResolver/);
    expect(result).toBe(0);
  });
});
