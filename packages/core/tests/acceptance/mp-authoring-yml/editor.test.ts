/**
 * marketplace-authoring-schema — YAML package editor add/set/remove + revalidate.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  authoringPackages,
  createTempProject,
  getAuthoringEditor,
  getLoadMarketplaceFromBapmYml,
  join,
  loadFailed,
  type TempProject,
  validAuthoringBapmYml,
  writeBapmYml,
} from "./helpers.ts";

describe("mp-authoring-yml YAML package editor", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("add package then reload includes entry", () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      [
        `name: acme`,
        `marketplace:`,
        `  owner: acme-org`,
        `  packages: []`,
        ``,
      ].join("\n"),
    );

    const editor = getAuthoringEditor();
    editor.add({
      cwd: project.cwd,
      path: join(project.cwd, "bapm.yml"),
      name: "tools",
      source: "acme/tools",
      ref: "main",
      noVerify: true,
    });

    const load = getLoadMarketplaceFromBapmYml();
    const result = load({ cwd: project.cwd, path: join(project.cwd, "bapm.yml") });
    expect(loadFailed(result)).toBe(false);
    const names = authoringPackages(result).map((p) => String(asRecord(p).name));
    expect(names).toContain("tools");
  });

  test("remove missing package fails closed without wiping others", () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validAuthoringBapmYml());

    const editor = getAuthoringEditor();
    let failed = false;
    try {
      const result = editor.remove({
        cwd: project.cwd,
        path: join(project.cwd, "bapm.yml"),
        name: "does-not-exist",
      });
      if (result && typeof result === "object" && "ok" in result) {
        failed = !(result as { ok: boolean }).ok;
      } else if (result === false) {
        failed = true;
      }
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);

    const load = getLoadMarketplaceFromBapmYml();
    const result = load({ cwd: project.cwd, path: join(project.cwd, "bapm.yml") });
    const names = authoringPackages(result).map((p) => String(asRecord(p).name));
    expect(names).toContain("demo");
  });

  test("set both version and ref fails closed", () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validAuthoringBapmYml());

    const editor = getAuthoringEditor();
    let failed = false;
    try {
      const result = editor.set({
        cwd: project.cwd,
        path: join(project.cwd, "bapm.yml"),
        name: "demo",
        version: "^1.0.0",
        ref: "main",
      });
      if (result && typeof result === "object" && "ok" in result) {
        failed = !(result as { ok: boolean }).ok;
      } else if (result === false) {
        failed = true;
      }
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
