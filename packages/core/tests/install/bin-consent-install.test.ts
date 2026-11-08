/**
 * Core install: --trust-bin / consent overlay gates dependency bin/ deploy.
 * Specs: install-trust-bin, install-pipeline.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  BIN_NAME,
  PKG_ID,
  SKILL_NAME,
  buildBinPluginZip,
  consumerManifest,
  createTempProject,
  deployedBinExists,
  flattenDiagnostics,
  gitDepYaml,
  hasBinWithholdDiagnostic,
  hasTrustBinWarning,
  installBinPlugin,
  installRegistryBinPlugin,
  projectBinAllowYaml,
  projectBinDenyYaml,
  registryDepYaml,
  startMockRegistry,
  writeManifestYaml,
  writeOrgDenyAllPolicy,
  writeOrgDenyPolicy,
  writeText,
  type MockRegistry,
  type TempProject,
} from "./trust-bin-helpers.ts";
import { addDeployedFilesToLock } from "./helpers.ts";

describe("install-trust-bin — non-interactive default skips bin", () => {
  let project: TempProject | undefined;
  let registry: MockRegistry | undefined;

  afterEach(async () => {
    project?.cleanup();
    project = undefined;
    await registry?.close();
    registry = undefined;
  });

  test("CI install skips bin without consent and emits withhold diagnostic", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "ci-skip-bin",
        target: "cursor",
        depYaml: gitDepYaml(),
      }),
    );

    const { result, skillNames } = await installBinPlugin(project.cwd, {
      trustBin: "default",
      isInteractive: false,
      env: { CI: "true" },
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(false);
    expect(hasBinWithholdDiagnostic(result)).toBe(true);
    expect(skillNames).toContain(SKILL_NAME);
  });

  test("frozen install skips bin without consent", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "frozen-skip-bin",
        target: "cursor",
        depYaml: gitDepYaml({ ref: "main" }),
      }),
    );
    // Warm non-frozen install without bin consent path first would leave deploy
    // artifacts; instead seed lock via a prior install then wipe deploy root.
    const { result: warm } = await installBinPlugin(project.cwd, {
      trustBin: "deny",
      isInteractive: false,
      frozen: false,
    });
    expect(warm).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(false);
    // Warm target reports primitive names but no harness files; record the
    // would-be deploy set so this test stays focused on bin consent.
    addDeployedFilesToLock(project.cwd, PKG_ID, [".agents/skills/bin-skill/SKILL.md"]);

    const { result } = await installBinPlugin(project.cwd, {
      trustBin: "default",
      isInteractive: false,
      frozen: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(false);
    expect(hasBinWithholdDiagnostic(result)).toBe(true);
  });

  test("non-interactive with project bin allow remains eligible", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "ni-allow",
        target: "cursor",
        executablesYaml: projectBinAllowYaml(),
        depYaml: gitDepYaml(),
      }),
    );

    const { result } = await installBinPlugin(project.cwd, {
      trustBin: "default",
      isInteractive: false,
      env: { CI: "true" },
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(true);
  });
});

describe("install-trust-bin — invocation flags overlay", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("--trust-bin / trustBin=allow deploys when ladder allows", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "flag-allow",
        target: "cursor",
        depYaml: gitDepYaml(),
      }),
    );

    const { result } = await installBinPlugin(project.cwd, {
      trustBin: "allow",
      isInteractive: false,
      env: { CI: "true" },
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(true);
    expect(hasTrustBinWarning(result)).toBe(false);
  });

  test("--no-trust-bin skips even when project allow would permit", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "flag-deny",
        target: "cursor",
        executablesYaml: projectBinAllowYaml(),
        depYaml: gitDepYaml(),
      }),
    );

    const { result, skillNames } = await installBinPlugin(project.cwd, {
      trustBin: "deny",
      isInteractive: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(false);
    expect(hasBinWithholdDiagnostic(result)).toBe(true);
    expect(skillNames).toContain(SKILL_NAME);
  });

  test("flags cannot override org deny", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "org-deny-wins",
        target: "cursor",
        depYaml: gitDepYaml(),
      }),
    );
    writeOrgDenyPolicy(project.cwd, PKG_ID);

    const { result } = await installBinPlugin(project.cwd, {
      trustBin: "allow",
      isInteractive: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(false);
    expect(hasBinWithholdDiagnostic(result)).toBe(true);
  });

  test("org deny_all beats --trust-bin", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "deny-all-wins",
        target: "cursor",
        depYaml: gitDepYaml(),
      }),
    );
    writeOrgDenyAllPolicy(project.cwd);

    const { result } = await installBinPlugin(project.cwd, {
      trustBin: "allow",
      isInteractive: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(false);
    expect(hasBinWithholdDiagnostic(result)).toBe(true);
  });

  test("project bin deny withholds even with trustBin allow", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "project-deny",
        target: "cursor",
        executablesYaml: projectBinDenyYaml(),
        depYaml: gitDepYaml(),
      }),
    );

    const { result } = await installBinPlugin(project.cwd, {
      trustBin: "allow",
      isInteractive: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(false);
    expect(hasBinWithholdDiagnostic(result)).toBe(true);
  });
});

describe("install-trust-bin — interactive default", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("interactive neither flag withholds when no grant and warns", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "interactive-withhold",
        target: "cursor",
        depYaml: gitDepYaml(),
      }),
    );

    const { result, skillNames } = await installBinPlugin(project.cwd, {
      trustBin: "default",
      isInteractive: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(false);
    expect(hasBinWithholdDiagnostic(result)).toBe(true);
    expect(hasTrustBinWarning(result)).toBe(true);
    expect(skillNames).toContain(SKILL_NAME);
  });

  test("interactive persisted project bin allow deploys without warning", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "interactive-allow-persisted",
        target: "cursor",
        executablesYaml: projectBinAllowYaml(),
        depYaml: gitDepYaml(),
      }),
    );

    const { result } = await installBinPlugin(project.cwd, {
      trustBin: "default",
      isInteractive: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(true);
    expect(hasTrustBinWarning(result)).toBe(false);
  });

  test("interactive persisted user bin grant (approve --bin) deploys", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    const configDir = join(project.cwd, ".bapm");
    writeText(
      join(configDir, "config.json"),
      `${JSON.stringify({ executables: { allow: { [PKG_ID]: { bin: true } }, deny: {} } }, null, 2)}\n`,
    );
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "interactive-user-allow",
        target: "cursor",
        depYaml: gitDepYaml(),
      }),
    );

    const { result } = await installBinPlugin(project.cwd, {
      trustBin: "default",
      isInteractive: true,
      configDir,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(true);
    expect(hasTrustBinWarning(result)).toBe(false);
  });

  test("interactive trustBin=allow deploys without trust-posture warning", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "interactive-allow",
        target: "cursor",
        depYaml: gitDepYaml(),
      }),
    );

    const { result } = await installBinPlugin(project.cwd, {
      trustBin: "allow",
      isInteractive: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(true);
    expect(hasTrustBinWarning(result)).toBe(false);
  });
});

describe("install-trust-bin — registry package bin gate", () => {
  let project: TempProject | undefined;
  let registry: MockRegistry | undefined;

  afterEach(async () => {
    project?.cleanup();
    project = undefined;
    await registry?.close();
    registry = undefined;
  });

  test("withheld bin is not written; skill still materializes", async () => {
    const bytes = buildBinPluginZip();
    registry = await startMockRegistry({
      packages: [
        {
          owner: "acme",
          repo: "bin-plugin",
          versions: [{ version: "1.0.0", bytes }],
        },
      ],
    });
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "registry-withhold",
        target: "cursor",
        registriesYaml: `registries:
  primary:
    url: ${registry.baseUrl}
  default: primary`,
        depYaml: registryDepYaml(),
      }),
    );

    const { result, skillNames } = await installRegistryBinPlugin(project.cwd, registry, {
      trustBin: "deny",
      isInteractive: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(false);
    expect(hasBinWithholdDiagnostic(result)).toBe(true);
    expect(skillNames).toContain(SKILL_NAME);
    expect(flattenDiagnostics(result)).not.toMatch(new RegExp(`${BIN_NAME}.*fatal`, "i"));
  });

  test("allowed bin may materialize to deploy root", async () => {
    const bytes = buildBinPluginZip();
    registry = await startMockRegistry({
      packages: [
        {
          owner: "acme",
          repo: "bin-plugin",
          versions: [{ version: "1.0.0", bytes }],
        },
      ],
    });
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({
        name: "registry-allow",
        target: "cursor",
        registriesYaml: `registries:
  primary:
    url: ${registry.baseUrl}
  default: primary`,
        depYaml: registryDepYaml(),
      }),
    );

    const { result } = await installRegistryBinPlugin(project.cwd, registry, {
      trustBin: "allow",
      isInteractive: false,
      env: { CI: "true" },
    });

    expect(result).toMatchObject({ ok: true });
    expect(deployedBinExists(project.cwd)).toBe(true);
  });
});
