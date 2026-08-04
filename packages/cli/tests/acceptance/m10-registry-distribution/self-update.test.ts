/**
 * M10 MUST: thin `bapm self-update --check` (+ help upgrade path).
 * Specs: cli-self-update. Checklist C §16–19. Design D7/D8: npm metadata; exit non-zero when update available.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  startMockNpmMetadata,
  type MockNpmMeta,
  type TempProject,
} from "./helpers.ts";

describe("CLI M10 bapm self-update --check", () => {
  let project: TempProject | undefined;
  let meta: MockNpmMeta | undefined;

  afterEach(async () => {
    project?.cleanup();
    project = undefined;
    await meta?.close();
    meta = undefined;
  });

  test("--check reports update available when remote newer (non-zero)", async () => {
    meta = await startMockNpmMetadata({ latest: "9.9.9" });
    project = createTempProject();

    const { result, combined } = await runInProject(
      project.cwd,
      ["self-update", "--check"],
      {
        BAPM_SELF_UPDATE_METADATA_URL: meta.baseUrl,
        BAPM_NPM_REGISTRY: meta.baseUrl,
        npm_config_registry: meta.baseUrl,
        BAPM_VERSION_OVERRIDE: "0.1.0",
      },
    );

    expectKnownCommand(combined, "self-update");
    expect(combined).toMatch(/update|newer|available|9\.9\.9/i);
    expect(combined).not.toMatch(/up[- ]to[- ]date|already latest/i);
    expect(result).not.toBe(0);
  });

  test("--check reports up-to-date when remote equals current (exit 0)", async () => {
    meta = await startMockNpmMetadata({ latest: "0.1.0" });
    project = createTempProject();

    const { result, combined } = await runInProject(
      project.cwd,
      ["self-update", "--check"],
      {
        BAPM_SELF_UPDATE_METADATA_URL: meta.baseUrl,
        BAPM_NPM_REGISTRY: meta.baseUrl,
        npm_config_registry: meta.baseUrl,
        BAPM_VERSION_OVERRIDE: "0.1.0",
      },
    );

    expectKnownCommand(combined, "self-update");
    expect(combined).toMatch(/up[- ]to[- ]date|no update|current|latest/i);
    expect(result).toBe(0);
  });

  test("unknown / 0.0.0 version does not claim latest", async () => {
    meta = await startMockNpmMetadata({ latest: "1.2.3" });
    project = createTempProject();

    const { result, combined } = await runInProject(
      project.cwd,
      ["self-update", "--check"],
      {
        BAPM_SELF_UPDATE_METADATA_URL: meta.baseUrl,
        BAPM_NPM_REGISTRY: meta.baseUrl,
        npm_config_registry: meta.baseUrl,
        BAPM_VERSION_OVERRIDE: "0.0.0",
      },
    );

    expectKnownCommand(combined, "self-update");
    expect(combined).toMatch(/unknown|undetermined|0\.0\.0|skip|warn|cannot/i);
    expect(combined).not.toMatch(/up[- ]to[- ]date as latest|you are on the latest/i);
    expect(result).not.toBe(0);
  });

  test("self-update help documents --check and npm upgrade path", async () => {
    project = createTempProject();

    const viaFlag = await runInProject(project.cwd, ["self-update", "--help"]);
    const viaHelp = await runInProject(project.cwd, ["help", "self-update"]);
    const text = [viaFlag.combined, viaHelp.combined].join("\n");

    expect(
      viaFlag.result === 0 || viaHelp.result === 0 || /self-update|--check/i.test(text),
    ).toBe(true);
    // Once command exists, help must mention check + upgrade
    if (!/unknown command/i.test(text)) {
      expect(text).toMatch(/--check/);
      expect(text).toMatch(/npm i -g|npm install -g|npm update -g/i);
    } else {
      expectKnownCommand(text, "self-update");
    }
  });
});
