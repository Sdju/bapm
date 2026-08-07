/**
 * marketplace-authoring-schema — init template shape; no host emit.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  getRenderInitMarketplaceBlock,
  hasHostMarketplaceJsonEmit,
  type TempProject,
} from "./authoring-helpers.ts";

describe("mp-authoring-yml init template", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("template includes owner, packages, build.tagPattern, outputs without emit", () => {
    project = createTempProject();
    const render = getRenderInitMarketplaceBlock();
    const fragment = render({
      owner: "acme-org",
      name: "my-mp",
      cwd: project.cwd,
    });

    const text = typeof fragment === "string" ? fragment : JSON.stringify(fragment);

    expect(text).toMatch(/owner/i);
    expect(text).toMatch(/acme-org/);
    expect(text).toMatch(/packages/i);
    expect(text).toMatch(/tagPattern|tag_pattern/i);
    expect(text).toMatch(/outputs|claude/i);
    expect(hasHostMarketplaceJsonEmit(project.cwd)).toBe(false);
    expect(text).not.toMatch(/\.claude-plugin\/marketplace\.json/);
  });
});
