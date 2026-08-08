/**
 * bapm init --target <id> emits object-map targets + active (not string-only target).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { loadManifest } from "@bapm/core";
import {
  createTempProject,
  expectKnownCommand,
  join,
  readFileSync,
  runInProject,
  type TempProject,
} from "./helpers.ts";

describe("opt-in-host-integrations · init object-map template", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("init -y --target cursor writes targets object-map and active", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, [
      "init",
      "-y",
      "cursor-pkg",
      "--target",
      "cursor",
    ]);
    expectKnownCommand(combined, "init");
    expect(result).toBe(0);

    const raw = readFileSync(join(project.cwd, "bapm.yml"), "utf8");
    expect(raw).toMatch(/targets:/);
    expect(raw).toMatch(/cursor:\s*["']?@bapm\/integration-cursor["']?/);
    expect(raw).toMatch(/active:/);
    expect(raw).toMatch(/-\s*cursor/);

    const { document: doc } = loadManifest({ cwd: project.cwd });
    const targets = doc.targets ?? doc.target;
    expect(targets).toBeTruthy();
    expect(typeof targets).toBe("object");
    expect(Array.isArray(targets)).toBe(false);
    expect((targets as Record<string, string>).cursor).toBe("@bapm/integration-cursor");
    expect(doc.active).toEqual(["cursor"]);
  });
});
