/**
 * Core producer — createMinimalManifest, serialize, validate-before-write.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  createTempProject,
  documentOf,
  expectThrowsMatching,
  getCreateMinimalManifest,
  getLoadManifest,
  getParseManifest,
  getProducerWrite,
  getSerializeManifest,
  type TempProject,
} from "./helpers.ts";

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

describe("M7 emit — createMinimalManifest + serialize (mf-001..003, mf-004 SHOULD)", () => {
  test("§1 createMinimalManifest emits mapping with non-empty name + string version", () => {
    const create = getCreateMinimalManifest();
    const raw = create({ name: "my-pkg" });
    const doc = documentOf(raw);
    expect(typeof doc.name).toBe("string");
    expect(String(doc.name).length).toBeGreaterThan(0);
    expect(typeof doc.version).toBe("string");
    expect(String(doc.version).length).toBeGreaterThan(0);

    const yaml = getSerializeManifest()(doc);
    const parsed = parseYaml(yaml);
    expect(parsed).not.toBeNull();
    expect(typeof parsed).toBe("object");
    expect(Array.isArray(parsed)).toBe(false);
    expect((parsed as Record<string, unknown>).name).toBe(doc.name);
    expect((parsed as Record<string, unknown>).version).toBe(doc.version);
  });

  test("§2 default version is semver-shaped (e.g. 0.1.0)", () => {
    const create = getCreateMinimalManifest();
    const doc = documentOf(create({ name: "semver-pkg" }));
    expect(String(doc.version)).toMatch(SEMVER_RE);
  });

  test("§5 init/minimal emit never includes workspaces (mf-021)", () => {
    const create = getCreateMinimalManifest();
    const doc = documentOf(create({ name: "no-ws" }));
    expect(doc).not.toHaveProperty("workspaces");
    expect(() => getParseManifest()(doc)).not.toThrow();
  });
});

describe("M7 producer write validate-before-emit", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("invalid emit (missing name) rejected — no successful durable artifact", () => {
    project = createTempProject();
    const write = getProducerWrite();
    const dest = join(project.cwd, "bapm.yml");
    expectThrowsMatching(
      () =>
        write({ version: "1.0.0" } as Record<string, unknown>, { cwd: project.cwd, path: dest }),
      /name/i,
    );
    // Fail-closed: either no file, or not a successful conforming publish.
    if (existsSync(dest)) {
      const text = readFileSync(dest, "utf8");
      expect(text).not.toMatch(/^name:\s*\S+/m);
    }
  });

  test("§6 vendor x-* preserved on round-trip write (ext-002)", () => {
    project = createTempProject();
    const write = getProducerWrite();
    const dest = join(project.cwd, "bapm.yml");
    write(
      {
        name: "x-preserve",
        version: "0.1.0",
        "x-acme-foo": { enabled: true },
        dependencies: { apm: [], mcp: [] },
      },
      { cwd: project.cwd, path: dest },
    );
    expect(existsSync(dest)).toBe(true);
    const loaded = getLoadManifest()({ cwd: project.cwd });
    const doc = documentOf(loaded);
    expect(doc["x-acme-foo"]).toEqual({ enabled: true });
    expect(doc).not.toHaveProperty("x-bapm-required");
  });

  test("§3 mf-005 reject invalid targets token with named diagnostic", () => {
    expectThrowsMatching(
      () =>
        getParseManifest()({
          name: "bad-target",
          version: "1.0.0",
          targets: ["not-a-host"],
        }),
      /not-a-host/i,
    );
  });

  test("vendor target token x-acme-editor accepted (mf-005)", () => {
    const doc = getParseManifest()({
      name: "vendor-target",
      version: "1.0.0",
      target: "x-acme-editor",
    });
    expect(doc.target).toBe("x-acme-editor");
  });

  test("mf-021 workspaces rejected on validate", () => {
    expectThrowsMatching(
      () =>
        getParseManifest()({
          name: "ws",
          version: "1.0.0",
          workspaces: ["packages/*"],
        }),
      /workspaces/i,
    );
  });
});
