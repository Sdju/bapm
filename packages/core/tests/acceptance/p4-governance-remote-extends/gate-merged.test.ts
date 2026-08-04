/**
 * P4 — install/lock gate consumes merged effective policy (policy-install-gate).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  expectRejectsMatching,
  getRunInstall,
  getRunPolicyGate,
  hasModulesContent,
  isBlocking,
  writeLeafProject,
  writePolicy,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("P4 install gate — merged effective policy", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("parent deny blocks install after extends merge", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p4-merge-deny");
    writeText(
      join(project.cwd, "parent.yml"),
      `name: parent\nenforcement: warn\ndependencies:\n  deny:\n    - leaf\n`,
    );
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: child\nextends: ./parent.yml\nenforcement: block\n`,
    );

    await expectRejectsMatching(
      () => getRunInstall()({ cwd: project.cwd }),
      /policy|deny|block|leaf|violat/i,
    );
    expect(hasModulesContent(project.cwd)).toBe(false);
  });

  test("runPolicyGate reports deny against merged effective policy", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "parent.yml"),
      `name: parent\nenforcement: warn\ndependencies:\n  deny:\n    - leaf\n`,
    );
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: child\nextends: ./parent.yml\nenforcement: block\n`,
    );

    const gate = getRunPolicyGate()({
      cwd: project.cwd,
      candidates: [{ id: "leaf", name: "leaf", depth: 1, direct: true }],
      dependencies: [{ name: "leaf", id: "leaf", depth: 1, direct: true }],
    });

    expect(isBlocking(gate)).toBe(true);
    const text = JSON.stringify(gate);
    expect(text).toMatch(/leaf|deny|violat/i);
  });
});
