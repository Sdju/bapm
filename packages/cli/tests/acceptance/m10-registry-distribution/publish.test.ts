/**
 * M10 MUST: thin `bapm publish` — flat zip PUT wire, dry-run, 409, experimental gate.
 * Specs: producer-publish, cli-runtime-surface. Checklist C §10–15.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildFlatPackageZip,
  createTempProject,
  expectKnownCommand,
  runInProject,
  startMockPublishRegistry,
  writeText,
  type MockPublishRegistry,
  type TempProject,
} from "./helpers.ts";

describe("CLI M10 bapm publish (flat zip PUT)", () => {
  let project: TempProject | undefined;
  let registry: MockPublishRegistry | undefined;

  afterEach(async () => {
    project?.cleanup();
    project = undefined;
    await registry?.close();
    registry = undefined;
  });

  test("publish PUTs flat zip to /v1/packages/{owner}/{repo}/versions/{version}", async () => {
    registry = await startMockPublishRegistry({ putStatus: 201 });
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      `name: contoso/demo
version: "1.2.3"
registries:
  primary:
    url: ${registry.baseUrl}
  default: primary
dependencies:
  apm: []
  mcp: []
`,
    );
    writeText(project.cwd, ".apm/keep.txt", "publish-me\n");

    const { result, combined } = await runInProject(project.cwd, ["publish"], {
      BAPM_EXPERIMENTAL_REGISTRIES: "1",
      BAPM_REGISTRY_TOKEN: "test-token",
    });

    expectKnownCommand(combined, "publish");
    expect(result).toBe(0);
    expect(registry.puts.length).toBe(1);
    expect(registry.puts[0]!.url).toMatch(/\/v1\/packages\/contoso\/demo\/versions\/1\.2\.3\/?$/);
    expect(registry.puts[0]!.body.subarray(0, 2).toString("utf8")).toBe("PK");
    const bodyText = registry.puts[0]!.body.toString("binary");
    expect(bodyText.includes("apm.yml")).toBe(true);
    expect(bodyText.includes(".apm/") || bodyText.includes(".apm\\")).toBe(true);
  });

  test("publish --dry-run performs no PUT", async () => {
    registry = await startMockPublishRegistry({ putStatus: 201 });
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      `name: contoso/demo
version: "1.0.0"
registries:
  primary:
    url: ${registry.baseUrl}
  default: primary
dependencies:
  apm: []
  mcp: []
`,
    );
    writeText(project.cwd, ".apm/keep.txt", "x\n");

    const { result, combined } = await runInProject(project.cwd, ["publish", "--dry-run"], {
      BAPM_EXPERIMENTAL_REGISTRIES: "1",
    });

    expectKnownCommand(combined, "publish");
    expect(result).toBe(0);
    expect(registry.puts).toHaveLength(0);
  });

  test("publish 409 surfaces immutability / bump version", async () => {
    registry = await startMockPublishRegistry({ putStatus: 409 });
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      `name: contoso/demo
version: "1.0.0"
registries:
  primary:
    url: ${registry.baseUrl}
  default: primary
dependencies:
  apm: []
  mcp: []
`,
    );
    writeText(project.cwd, ".apm/keep.txt", "x\n");

    const { result, combined } = await runInProject(project.cwd, ["publish"], {
      BAPM_EXPERIMENTAL_REGISTRIES: "1",
      BAPM_REGISTRY_TOKEN: "test-token",
    });

    expectKnownCommand(combined, "publish");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/409|immutab|already|bump|conflict/i);
  });

  test("publish --zip uploads given archive without rebuild", async () => {
    registry = await startMockPublishRegistry({ putStatus: 201 });
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      `name: contoso/demo
version: "9.9.9"
registries:
  primary:
    url: ${registry.baseUrl}
  default: primary
dependencies:
  apm: []
  mcp: []
`,
    );
    const zipBytes = buildFlatPackageZip({ name: "contoso/demo", version: "9.9.9" });
    const zipPath = join(project.cwd, "prebuilt.zip");
    writeFileSync(zipPath, zipBytes);

    const { result, combined } = await runInProject(project.cwd, ["publish", "--zip", zipPath], {
      BAPM_EXPERIMENTAL_REGISTRIES: "1",
      BAPM_REGISTRY_TOKEN: "tok",
    });

    expectKnownCommand(combined, "publish");
    expect(result).toBe(0);
    expect(registry.puts.length).toBe(1);
    expect(Buffer.from(registry.puts[0]!.body).equals(Buffer.from(zipBytes))).toBe(true);
  });

  test("publish refused when experimental gate off", async () => {
    registry = await startMockPublishRegistry({ putStatus: 201 });
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      `name: contoso/demo
version: "1.0.0"
registries:
  primary:
    url: ${registry.baseUrl}
  default: primary
dependencies:
  apm: []
  mcp: []
`,
    );
    writeText(project.cwd, ".apm/keep.txt", "x\n");

    const { result, combined } = await runInProject(project.cwd, ["publish"], {
      BAPM_EXPERIMENTAL_REGISTRIES: undefined,
    });

    expectKnownCommand(combined, "publish");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/experimental|BAPM_EXPERIMENTAL_REGISTRIES|enable/i);
    expect(registry.puts).toHaveLength(0);
  });

  test("missing .apm fails without --zip", async () => {
    registry = await startMockPublishRegistry({ putStatus: 201 });
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      `name: contoso/demo
version: "1.0.0"
registries:
  primary:
    url: ${registry.baseUrl}
  default: primary
dependencies:
  apm: []
  mcp: []
`,
    );

    const { result, combined } = await runInProject(project.cwd, ["publish"], {
      BAPM_EXPERIMENTAL_REGISTRIES: "1",
    });

    expectKnownCommand(combined, "publish");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/\.apm|missing|required/i);
    expect(registry.puts).toHaveLength(0);
  });
});
