/**
 * G7 / marketplace-pack-outputs — fail-closed offline, path jail, non-github remotes.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  hasAnyHostMarketplaceJson,
  hasClaudeMarketplaceJson,
  linkClaudeIntegration,
  runInProject,
  type TempProject,
  writeClaudeLocalAuthoring,
  writeRemoteGithubAuthoring,
  writeText,
} from "./pack-outputs-helpers.ts";

describe("mp-pack-outputs CLI fail-closed resolve / path jail", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("path escape via --marketplace-path fails closed without writing artifact", async () => {
    project = createTempProject();
    writeClaudeLocalAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "claude",
      "--marketplace-path",
      "claude=../../outside/marketplace.json",
    ]);
    expectKnownCommand(combined, "pack");
    // Must accept marketplace flags; fail on jail — not on unknown-flag parse.
    expect(combined).not.toMatch(/Unknown pack flag:\s*--marketplace(-path)?\b/i);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/path|jail|outside|escape|project root|within/i);
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(false);
  });

  test("--offline with remote package needing resolve fails closed — no durable JSON", async () => {
    project = createTempProject();
    writeRemoteGithubAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "claude",
      "--offline",
    ]);
    expectKnownCommand(combined, "pack");
    expect(combined).not.toMatch(/Unknown pack flag:\s*--(marketplace|offline)\b/i);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/offline|resolve|network|ref|sha|ls-remote/i);
    expect(hasAnyHostMarketplaceJson(project.cwd)).toBe(false);
  });

  test("non-github remote on emit fails closed", async () => {
    project = createTempProject();
    linkClaudeIntegration(project.cwd);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        `name: gitlab-mp`,
        `version: "0.1.0"`,
        `marketplace:`,
        `  owner: acme-org`,
        `  outputs:`,
        `    claude: true`,
        `  packages:`,
        `    - name: demo`,
        `      source: gitlab.com/acme/tools`,
        `      ref: main`,
        ``,
      ].join("\n"),
    );

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "claude",
    ]);
    expectKnownCommand(combined, "pack");
    expect(combined).not.toMatch(/Unknown pack flag:\s*--marketplace\b/i);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/gitlab|host|unsupported|not supported|auth|remote/i);
    expect(hasAnyHostMarketplaceJson(project.cwd)).toBe(false);
  });
});
