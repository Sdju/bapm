/**
 * Core pack — checkReleaseTag (tag↔version gate).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  expectRejectsMatching,
  getCheckReleaseTag,
  writeConformingManifest,
  type TempProject,
} from "./helpers.ts";

describe("M7 release gate — checkReleaseTag (pr-004)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§10 aligned tag v1.2.3 vs version 1.2.3 passes", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "rel-ok", version: "1.2.3" });

    const result = await getCheckReleaseTag()({
      cwd: project.cwd,
      tag: "v1.2.3",
    });
    // Gate pass: no throw; optional { ok: true } / exitCode 0 bag.
    if (result !== null && typeof result === "object" && "ok" in (result as object)) {
      expect((result as { ok: unknown }).ok).toBe(true);
    }
    if (result !== null && typeof result === "object" && "exitCode" in (result as object)) {
      expect((result as { exitCode: unknown }).exitCode).toBe(0);
    }
  });

  test("aligned tag without v prefix also passes", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "rel-ok2", version: "1.2.3" });

    await getCheckReleaseTag()({
      cwd: project.cwd,
      tag: "1.2.3",
    });
  });

  test("§11 mismatched tag v9.9.9 fails closed", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "rel-bad", version: "1.2.3" });

    await expectRejectsMatching(
      () =>
        getCheckReleaseTag()({
          cwd: project.cwd,
          tag: "v9.9.9",
        }),
      /1\.2\.3|9\.9\.9|mismatch|version|tag/i,
    );
  });

  test("§12 non-semver release tag fails regex gate", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "rel-shape", version: "1.2.3" });

    await expectRejectsMatching(
      () =>
        getCheckReleaseTag()({
          cwd: project.cwd,
          tag: "release-foo",
        }),
      /semver|regex|tag|shape|invalid/i,
    );
  });

  test("missing tag without --tag / HEAD fails closed", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "rel-missing", version: "1.0.0" });

    await expectRejectsMatching(
      () =>
        getCheckReleaseTag()({
          cwd: project.cwd,
          // no tag; cwd is not a git repo with HEAD tags
        }),
      /tag|required|missing|HEAD|release/i,
    );
  });

  test("§13 pr-005 unsigned aligned tag MUST NOT fail solely for unsigned", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "rel-unsigned", version: "2.0.0" });

    // Explicit unsigned advisory mode — MUST pass gate for alignment alone.
    const result = await getCheckReleaseTag()({
      cwd: project.cwd,
      tag: "v2.0.0",
      unsigned: true,
      requireSignature: false,
    });
    if (result !== null && typeof result === "object" && "ok" in (result as object)) {
      expect((result as { ok: unknown }).ok).toBe(true);
    }
  });
});
