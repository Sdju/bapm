/**
 * Marketplace Claude/Codex load on demand — not static CLI built-ins
 * (promoted from opt-in-host-integrations acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  hasClaudeMarketplaceJson,
  runInProject,
  type TempProject,
  writeClaudeLocalAuthoring,
} from "./pack-outputs-helpers.ts";

describe("CLI pack · marketplace on-demand load", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("pack selecting Claude without resolvable @bapm/integration-claude fails closed with install guidance", async () => {
    project = createTempProject();
    writeClaudeLocalAuthoring(project.cwd, { linkIntegration: false });

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
});
