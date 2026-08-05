/**
 * p6g — core update plan verbosity gates keep rows (lifecycle-update).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  getRunUpdate,
  honestEmptyChangePattern,
  keepPlanPattern,
  planOf,
  readUpdateTypesSource,
  textOf,
  writeLeafFixture,
  writeMixedPlanFixture,
  type TempProject,
} from "./helpers.ts";

describe("p6g core update plan verbosity", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("RunUpdateOptions exposes verbose?: boolean", () => {
    expect(readUpdateTypesSource()).toMatch(/\bverbose\??\s*:\s*boolean/);
  });

  test("dry-run without verbose hides keep/[=] but keeps internal plan", async () => {
    project = createTempProject();
    const { ports } = writeMixedPlanFixture(project.cwd);
    const runUpdate = getRunUpdate();

    const result = await runUpdate({
      cwd: project.cwd,
      dryRun: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const text = textOf(result);
    expect(text).not.toMatch(keepPlanPattern());
    expect(text).toMatch(/\[~\]|\[+\]|update|pkg-a/i);

    const plan = planOf(result);
    expect(plan.some((p) => String(p.action) === "keep")).toBe(true);
  });

  test("dry-run with verbose shows keep/[=] rows", async () => {
    project = createTempProject();
    const { ports } = writeMixedPlanFixture(project.cwd);
    const runUpdate = getRunUpdate();

    const result = await runUpdate({
      cwd: project.cwd,
      dryRun: true,
      verbose: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(textOf(result)).toMatch(keepPlanPattern());
  });

  test("all-keep dry-run without verbose stays honest", async () => {
    project = createTempProject();
    writeLeafFixture(project.cwd, "p6g-all-keep");
    const runUpdate = getRunUpdate();

    const result = await runUpdate({
      cwd: project.cwd,
      dryRun: true,
    });

    const text = textOf(result);
    expect(text).not.toMatch(keepPlanPattern());
    expect(text).toMatch(honestEmptyChangePattern());
  });
});
