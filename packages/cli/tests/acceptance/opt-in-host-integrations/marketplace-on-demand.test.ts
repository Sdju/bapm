/**
 * Marketplace Claude/Codex load on demand — not static CLI built-ins.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  hasClaudeMarketplaceJson,
  linkClaudeIntegration,
  runInProject,
  writeClaudeLocalAuthoring,
  type TempProject,
} from "./helpers.ts";

describe("opt-in-host-integrations · marketplace on-demand load", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("pack selecting Claude without resolvable @bapm/integration-claude fails closed with install guidance", async () => {
    project = createTempProject();
    writeClaudeLocalAuthoring(project.cwd);
    // Intentionally do NOT link @bapm/integration-claude into project node_modules.

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "claude",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/@bapm\/integration-claude|install.*claude|claude.*integration/i);
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(false);
  });

  test("pack selecting Claude with linked @bapm/integration-claude writes marketplace.json", async () => {
    project = createTempProject();
    linkClaudeIntegration(project.cwd);
    writeClaudeLocalAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "claude",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(true);
  });
});
