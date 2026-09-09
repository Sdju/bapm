/**
 * Classify / resolve carry skillSubset + targetSubset; fetch is not narrowed.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { classifyDependencyRef, resolveAndLock } from "@b-apm/core";
import {
  KEEP_SKILL,
  DROP_SKILL,
  TOOLKIT_ID,
  GIT_URL,
  createFakePorts,
  createTempProject,
  createToolkitDownloader,
  gitObjectDepYaml,
  listModulesFiles,
  writeManifestYaml,
  type TempProject,
} from "../manifest/deps-subset-helpers.ts";

type SubsetCarrier = {
  kind?: string;
  skillSubset?: unknown;
  targetSubset?: unknown;
};

describe("classify retains consumer skill and target subsets", () => {
  test("registry object-form subset survives classify without changing kind", () => {
    const classified = classifyDependencyRef({
      id: TOOLKIT_ID,
      version: "1.0.0",
      skills: ["alpha"],
      targets: ["cursor"],
    }) as SubsetCarrier;
    expect(classified.kind).toBe("registry");
    expect(classified.skillSubset).toEqual(["alpha"]);
    expect(classified.targetSubset).toEqual(["cursor"]);
  });

  test("git object-form subset survives classify without changing kind", () => {
    const classified = classifyDependencyRef({
      git: GIT_URL,
      skills: ["alpha"],
    }) as SubsetCarrier;
    expect(classified.kind).toMatch(/^git-/);
    expect(classified.skillSubset).toEqual(["alpha"]);
  });

  test("string-form declarations carry no subset", () => {
    const classified = classifyDependencyRef("acme/toolkit") as SubsetCarrier;
    expect(classified.skillSubset ?? undefined).toBeUndefined();
    expect(classified.targetSubset ?? undefined).toBeUndefined();
  });
});

describe("resolve carries subsets and still downloads the full tree", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("resolved git node exposes skillSubset and modules still contain omitted skills", async () => {
    project = createTempProject();
    writeManifestYaml(
      project.cwd,
      `name: resolve-subset
version: 0.0.1
dependencies:
  apm:
${gitObjectDepYaml({ skills: [KEEP_SKILL] })}
`,
    );
    const ports = createFakePorts();
    const result = await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: createToolkitDownloader(),
    });
    const node = result.nodes.find((n) => n.kind.startsWith("git")) as SubsetCarrier | undefined;
    expect(node, "expected a git resolved node").toBeTruthy();
    expect(node!.skillSubset).toEqual([KEEP_SKILL]);
    const files = listModulesFiles(project.cwd).join("\n");
    expect(files).toMatch(new RegExp(`${KEEP_SKILL}/SKILL\\.md`));
    expect(files).toMatch(new RegExp(`${DROP_SKILL}/SKILL\\.md`));
    expect(files).toMatch(/extra\.txt/);
  });
});
