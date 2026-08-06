/**
 * plugin-scaffold — plugin.json writer fields + trailing newline.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  createTempProject,
  getCreatePluginJson,
  getWritePluginJson,
  join,
  readText,
  type TempProject,
  existsSync,
} from "./helpers.ts";

describe("mp-plugin-init plugin.json writer", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("default yes plugin.json shape (create helper)", () => {
    const create = getCreatePluginJson();
    const rawOrDoc = create({
      name: "demo-plugin",
      version: "0.1.0",
      description: "",
      author: { name: "author" },
      license: "MIT",
    });

    let doc: Record<string, unknown>;
    let serialized: string | undefined;
    if (typeof rawOrDoc === "string") {
      serialized = rawOrDoc;
      doc = asRecord(JSON.parse(rawOrDoc));
    } else {
      doc = asRecord(rawOrDoc);
      serialized = `${JSON.stringify(doc, null, 2)}\n`;
    }

    expect(doc.name).toBe("demo-plugin");
    expect(doc.version).toBe("0.1.0");
    expect(typeof doc.description).toBe("string");
    expect(asRecord(doc.author).name).toEqual(expect.any(String));
    expect(doc.license).toBe("MIT");
    expect(serialized.endsWith("\n")).toBe(true);
  });

  test("writePluginJson emits file with indent-2 JSON + trailing newline", () => {
    project = createTempProject();
    const write = getWritePluginJson();
    write({
      cwd: project.cwd,
      path: join(project.cwd, "plugin.json"),
      name: "demo-plugin",
      version: "0.1.0",
      description: "Demo",
      author: { name: "author" },
      license: "MIT",
    });

    const path = join(project.cwd, "plugin.json");
    expect(existsSync(path)).toBe(true);
    const raw = readText(path);
    expect(raw.endsWith("\n")).toBe(true);
    // indent width 2: second line starts with two spaces after `{`
    expect(raw).toMatch(/\{\n {2}"name"/);

    const doc = asRecord(JSON.parse(raw));
    expect(doc.name).toBe("demo-plugin");
    expect(doc.version).toBe("0.1.0");
    expect(doc.license).toBe("MIT");
    expect(asRecord(doc.author).name).toEqual(expect.any(String));
  });
});
