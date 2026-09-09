/**
 * Acceptance (RED): producer emit validates structured `active` only.
 * OpenSpec change: manifest-presets
 * Spec: manifest-yaml-validate (emit)
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import {
  baseManifest,
  createTempProject,
  expectThrowsMatching,
  getWriteProducerManifest,
  join,
  type TempProject,
} from "./helpers.ts";

describe("manifest-presets emit — structured active", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("emit rejects legacy bare active list before writing", () => {
    project = createTempProject();
    expectThrowsMatching(
      () =>
        getWriteProducerManifest()(baseManifest({ active: ["cursor"] }), {
          cwd: project!.cwd,
          path: join(project!.cwd, "bapm.yml"),
        }),
      /active|legacy|bare|structured|preset|target/i,
    );
  });

  test("emit accepts structured target active", () => {
    project = createTempProject();
    const result = getWriteProducerManifest()(baseManifest({ active: { target: "cursor" } }), {
      cwd: project.cwd,
      path: join(project.cwd, "bapm.yml"),
    }) as { path?: string };

    expect(result.path).toMatch(/bapm\.yml$/);
    const yaml = readFileSync(join(project.cwd, "bapm.yml"), "utf8");
    expect(yaml).toMatch(/active:/);
    expect(yaml).toMatch(/target:/);
    expect(yaml).toMatch(/cursor/);
    expect(yaml).not.toMatch(/active:\s*\n\s*-\s*cursor/);
  });
});
