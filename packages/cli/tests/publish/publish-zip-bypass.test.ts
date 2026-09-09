/**
 * CLI publish --zip bypass: prebuilt archive MUST NOT re-filter via .bapmignore.
 *
 * Spec: producer-publish.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  startMockPublishRegistry,
  writeText,
  type MockPublishRegistry,
  type TempProject,
} from "../registry/helpers.ts";

/** Minimal store-only ZIP with optional README member. */
function buildPrebuiltZipWithReadme(name: string, version: string): Uint8Array {
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {
    "apm.yml": enc.encode(
      `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`,
    ),
    ".apm/keep.txt": enc.encode("ok\n"),
    "README.md": enc.encode("# shipped-in-prebuilt\n"),
  };
  return createStoreZip(files);
}

function createStoreZip(files: Record<string, Uint8Array>): Uint8Array {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.byteLength, 18);
    local.writeUInt32LE(data.byteLength, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    parts.push(local, Buffer.from(data));

    const cen = Buffer.alloc(46 + nameBuf.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(0, 16);
    cen.writeUInt32LE(data.byteLength, 20);
    cen.writeUInt32LE(data.byteLength, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    nameBuf.copy(cen, 46);
    central.push(cen);
    offset += local.length + data.byteLength;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, centralBuf, end]);
}

describe("bapmignore — publish --zip bypass", () => {
  let project: TempProject | undefined;
  let registry: MockPublishRegistry | undefined;

  afterEach(async () => {
    project?.cleanup();
    project = undefined;
    await registry?.close();
    registry = undefined;
  });

  test("publish --zip uploads prebuilt bytes without rebuilding through .bapmignore", async () => {
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
    // Would omit README / .apm if rebuild applied ignore — prebuilt zip still contains them.
    writeText(project.cwd, ".bapmignore", "README.md\n.apm/**\n");
    writeText(project.cwd, "README.md", "# would-be-omitted-on-rebuild\n");
    writeText(project.cwd, ".apm/keep.txt", "tree-content\n");

    const zipBytes = buildPrebuiltZipWithReadme("contoso/demo", "9.9.9");
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
    // Latin-1 scan: README member name survives upload unchanged (ignore not reapplied).
    expect(registry.puts[0]!.body.toString("binary")).toContain("README.md");
  });
});
