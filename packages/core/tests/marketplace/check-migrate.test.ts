/**
 * marketplace-authoring-schema + check — offline schema path; migrate dry-run.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  createTempProject,
  getCheckAuthoringMarketplace,
  getMigrateMarketplaceYml,
  join,
  readText,
  type TempProject,
  validAuthoringBapmYml,
  writeBapmYml,
  writeText,
} from "./authoring-helpers.ts";

function checkOk(result: unknown): boolean {
  if (typeof result === "boolean") return result;
  if (typeof result === "number") return result === 0;
  const row = asRecord(result);
  if (typeof row.ok === "boolean") return row.ok;
  if (typeof row.exitCode === "number") return row.exitCode === 0;
  if (typeof row.code === "number") return row.code === 0;
  if (Array.isArray(row.errors) && row.errors.length > 0) return false;
  return true;
}

describe("mp-authoring-yml check + migrate (core)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("check offline passes valid local authoring config", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validAuthoringBapmYml());
    writeText(join(project.cwd, "plugins", "demo", ".keep"), "");

    const check = getCheckAuthoringMarketplace();
    const result = await check({
      cwd: project.cwd,
      offline: true,
      path: join(project.cwd, "bapm.yml"),
    });
    expect(checkOk(result)).toBe(true);
  });

  test("check fails on invalid source in marketplace block", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      [
        `name: acme`,
        `marketplace:`,
        `  owner: acme-org`,
        `  packages:`,
        `    - name: bad`,
        `      source: plugins/no-dot-slash`,
        ``,
      ].join("\n"),
    );

    const check = getCheckAuthoringMarketplace();
    let failed = false;
    try {
      const result = await check({
        cwd: project.cwd,
        offline: true,
        path: join(project.cwd, "bapm.yml"),
      });
      failed = !checkOk(result);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  test("migrate --dry-run does not write marketplace block into bapm.yml", () => {
    project = createTempProject();
    writeBapmYml(project.cwd, `name: bare\nversion: "0.0.1"\n`);
    writeText(
      join(project.cwd, "marketplace.yml"),
      [`owner: legacy-org`, `packages:`, `  - name: old`, `    source: ./old`, ``].join("\n"),
    );
    const before = readText(join(project.cwd, "bapm.yml"));

    const migrate = getMigrateMarketplaceYml();
    const result = migrate({
      cwd: project.cwd,
      dryRun: true,
      force: true,
    });
    const row = result && typeof result === "object" ? asRecord(result) : { ok: result !== false };
    expect(row.ok === false ? false : true).toBe(true);

    const after = readText(join(project.cwd, "bapm.yml"));
    expect(after).toBe(before);
    expect(after).not.toMatch(/^marketplace:/m);
  });
});
