/**
 * Install materializes only declared skill/target subsets (registry id: + git parity).
 * Empty skill-subset match is diagnosed (req-mf-022).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  DROP_SKILL,
  KEEP_COMMAND,
  KEEP_SKILL,
  STALE_SKILL,
  buildToolkitZip,
  consumerManifest,
  createTempProject,
  flattenDiagnostics,
  gitObjectDepYaml,
  installRegistryToolkit,
  installWithCursorSpy,
  listModulesFiles,
  registryIdDepYaml,
  startMockRegistry,
  writeManifestYaml,
  type MockRegistry,
  type TempProject,
} from "../manifest/deps-subset-helpers.ts";

describe("install materializes only the declared subset", () => {
  let project: TempProject | undefined;
  let registry: MockRegistry | undefined;

  afterEach(async () => {
    project?.cleanup();
    project = undefined;
    await registry?.close();
    registry = undefined;
  });

  test("registry id skills subset omits other skills but keeps non-skill primitives", async () => {
    const bytes = buildToolkitZip();
    registry = await startMockRegistry({
      packages: [
        {
          owner: "acme",
          repo: "toolkit",
          versions: [{ version: "1.0.0", bytes }],
        },
      ],
    });
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "id-subset",
        target: "cursor",
        registriesYaml: `registries:
  primary:
    url: ${registry.baseUrl}
  default: primary`,
        depYaml: registryIdDepYaml({ skills: [KEEP_SKILL] }),
      }),
    );

    const { result, skillNames, names } = await installRegistryToolkit(project.cwd, registry);
    expect(result).toMatchObject({ ok: true });
    expect(skillNames).toContain(KEEP_SKILL);
    expect(skillNames).not.toContain(DROP_SKILL);
    expect(names.some((p) => p.name === KEEP_COMMAND)).toBe(true);
    const files = listModulesFiles(project.cwd).join("\n");
    expect(files).toMatch(new RegExp(`${DROP_SKILL}/SKILL\\.md`));
  });

  test("git-longhand skills subset matches the registry id outcome", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "git-subset",
        target: "cursor",
        depYaml: gitObjectDepYaml({ skills: [KEEP_SKILL] }),
      }),
    );

    const { result, skillNames, names } = await installWithCursorSpy(project.cwd);
    expect(result).toMatchObject({ ok: true });
    expect(skillNames).toContain(KEEP_SKILL);
    expect(skillNames).not.toContain(DROP_SKILL);
    expect(names.some((p) => p.name === KEEP_COMMAND)).toBe(true);
  });

  test("omitted skills deploys all selectable skills", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "no-subset",
        target: "cursor",
        depYaml: gitObjectDepYaml({}),
      }),
    );

    const { skillNames } = await installWithCursorSpy(project.cwd);
    expect(skillNames).toContain(KEEP_SKILL);
    expect(skillNames).toContain(DROP_SKILL);
  });

  test("per-dep targets subset skips non-overlapping active cursor", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "per-dep-targets-skip",
        target: "cursor",
        depYaml: gitObjectDepYaml({ targets: ["copilot"] }),
      }),
    );

    const { skillNames } = await installWithCursorSpy(project.cwd, { activeTargets: ["cursor"] });
    expect(skillNames).not.toContain(KEEP_SKILL);
    expect(skillNames).not.toContain(DROP_SKILL);
  });

  test("matching per-dep target still deploys to cursor", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "per-dep-targets-hit",
        target: "cursor",
        depYaml: gitObjectDepYaml({ targets: ["cursor"] }),
      }),
    );

    const { skillNames } = await installWithCursorSpy(project.cwd, { activeTargets: ["cursor"] });
    expect(skillNames).toContain(KEEP_SKILL);
    expect(skillNames).toContain(DROP_SKILL);
  });
});

describe("skill-subset mismatches are diagnosed (req-mf-022)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("stale skill pin warns with dependency, requested, and available names", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "stale-pin",
        target: "cursor",
        depYaml: gitObjectDepYaml({ skills: [STALE_SKILL] }),
      }),
    );

    const { result, skillNames } = await installWithCursorSpy(project.cwd);
    expect(result).toMatchObject({ ok: true });
    expect(skillNames).not.toContain(KEEP_SKILL);
    expect(skillNames).not.toContain(DROP_SKILL);
    expect(skillNames).not.toContain(STALE_SKILL);
    const diag = subsetDiagnostic(result, "EMPTY_SKILL_SUBSET");
    expect(diag).toMatchObject({
      code: "EMPTY_SKILL_SUBSET",
      warn: true,
      requested: [STALE_SKILL],
    });
    expect(diag?.unmatched).toEqual([STALE_SKILL]);
    const blob = flattenDiagnostics(result);
    expect(blob).toMatch(new RegExp(STALE_SKILL));
    expect(blob).toMatch(new RegExp(`${KEEP_SKILL}|${DROP_SKILL}`));
    expect(blob).toMatch(/acme\/toolkit|toolkit|git:/i);
  });

  test("partial skill subset warns about leftover unknown names", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "partial-pin",
        target: "cursor",
        depYaml: gitObjectDepYaml({ skills: [KEEP_SKILL, STALE_SKILL] }),
      }),
    );

    const { result, skillNames } = await installWithCursorSpy(project.cwd);
    expect(result).toMatchObject({ ok: true });
    expect(skillNames).toContain(KEEP_SKILL);
    expect(skillNames).not.toContain(DROP_SKILL);
    expect(skillNames).not.toContain(STALE_SKILL);
    const diag = subsetDiagnostic(result, "SKILL_SUBSET_UNMATCHED");
    expect(diag).toMatchObject({
      code: "SKILL_SUBSET_UNMATCHED",
      warn: true,
    });
    expect(diag?.unmatched).toEqual([STALE_SKILL]);
    expect(flattenDiagnostics(result)).toMatch(new RegExp(STALE_SKILL));
  });

  test("exact skill subset does not diagnose unmatched names", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "exact-pin",
        target: "cursor",
        depYaml: gitObjectDepYaml({ skills: [KEEP_SKILL] }),
      }),
    );

    const { result, skillNames } = await installWithCursorSpy(project.cwd);
    expect(result).toMatchObject({ ok: true });
    expect(skillNames).toContain(KEEP_SKILL);
    expect(skillNames).not.toContain(DROP_SKILL);
    expect(subsetDiagnostic(result, "EMPTY_SKILL_SUBSET")).toBeUndefined();
    expect(subsetDiagnostic(result, "SKILL_SUBSET_UNMATCHED")).toBeUndefined();
  });
});

function subsetDiagnostic(result: unknown, code: string): Record<string, unknown> | undefined {
  if (!result || typeof result !== "object") return undefined;
  const bag = (result as { diagnostics?: unknown }).diagnostics;
  if (!Array.isArray(bag)) return undefined;
  return bag.find(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && (item as { code?: unknown }).code === code,
  );
}
