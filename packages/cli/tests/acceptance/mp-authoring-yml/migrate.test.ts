/**
 * marketplace-cli-authoring — thin migrate SHOULD (dry-run no write).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownMarketplaceSub,
  readText,
  runInProject,
  type TempProject,
  writeText,
} from "./helpers.ts";

describe("mp-authoring-yml CLI marketplace migrate", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("migrate --dry-run does not write marketplace block", async () => {
    project = createTempProject();
    writeText(project.cwd, "bapm.yml", `name: bare\nversion: "0.0.1"\n`);
    writeText(
      project.cwd,
      "marketplace.yml",
      [`owner: legacy-org`, `packages:`, `  - name: old`, `    source: ./old`, ``].join("\n"),
    );
    const before = readText(project.cwd, "bapm.yml");

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "migrate",
      "--dry-run",
    ]);
    expectKnownMarketplaceSub(combined, "migrate");
    expect(result).toBe(0);
    expect(readText(project.cwd, "bapm.yml")).toBe(before);
    expect(before).not.toMatch(/^marketplace:/m);
  });
});
