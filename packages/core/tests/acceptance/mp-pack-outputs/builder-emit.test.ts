/**
 * G1–G4 — core builder resolve local packages + Claude write (soft API).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  getBuildMarketplaceOutputs,
  getResolveMarketplacePackages,
  type TempProject,
  validLocalAuthoringYml,
  writeBapmYml,
  writeText,
} from "./helpers.ts";

describe("mp-pack-outputs core builder resolve + emit", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("resolve local ./ package without network yields ResolvedPackage-like entry", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validLocalAuthoringYml());
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");

    const resolve = getResolveMarketplacePackages();
    const result = await Promise.resolve(resolve({ cwd: project.cwd }));
    const list = Array.isArray(result)
      ? result
      : ((result as { packages?: unknown[]; resolved?: unknown[] }).packages ??
        (result as { packages?: unknown[]; resolved?: unknown[] }).resolved);
    expect(Array.isArray(list), `expected ResolvedPackage[], got ${JSON.stringify(result)}`).toBe(
      true,
    );
    expect(list!.length).toBeGreaterThanOrEqual(1);
    const demo = (list as Record<string, unknown>[]).find(
      (p) => p.name === "demo" || String(p.source ?? "").includes("plugins/demo"),
    );
    expect(demo, "expected local demo package in resolve result").toBeTruthy();
  });

  test("buildMarketplaceOutputs writes Claude JSON under path jail", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validLocalAuthoringYml());
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");

    const build = getBuildMarketplaceOutputs();
    const result = await Promise.resolve(
      build({
        cwd: project.cwd,
        marketplace: "claude",
        dryRun: false,
      }),
    );
    const ok =
      result === undefined ||
      result === null ||
      (typeof result === "object" &&
        ((result as { ok?: boolean }).ok === true ||
          (result as { success?: boolean }).success === true ||
          (result as { written?: unknown[] }).written !== undefined));
    expect(ok || existsSync(join(project.cwd, ".claude-plugin/marketplace.json"))).toBe(true);

    const path = join(project.cwd, ".claude-plugin", "marketplace.json");
    expect(existsSync(path)).toBe(true);
    const raw = readFileSync(path, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    const doc = JSON.parse(raw) as { plugins?: unknown[] };
    expect(Array.isArray(doc.plugins)).toBe(true);
  });

  test("dry-run build does not leave durable marketplace.json", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validLocalAuthoringYml());
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");

    const build = getBuildMarketplaceOutputs();
    await Promise.resolve(
      build({
        cwd: project.cwd,
        marketplace: "claude",
        dryRun: true,
      }),
    );
    expect(existsSync(join(project.cwd, ".claude-plugin/marketplace.json"))).toBe(false);
  });
});
