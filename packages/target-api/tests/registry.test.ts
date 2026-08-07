/**
 * bapm-target-api package identity and registry contracts.
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTargetRegistry, createRegistry } from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("bapm-target-api package", () => {
  test("package is bapm-target-api with vite-plus scripts", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      scripts?: Record<string, string>;
      type?: string;
    };
    expect(pkg.name).toBe("bapm-target-api");
    expect(pkg.type).toBe("module");
    expect(pkg.scripts?.build ?? pkg.scripts?.test ?? pkg.scripts?.check).toBeTruthy();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
  });
});

describe("target registry contracts", () => {
  test("createTargetRegistry and createRegistry are aliases", () => {
    expect(createRegistry).toBe(createTargetRegistry);
  });

  test("register target — list exposes id + deploy roots", () => {
    const registry = createTargetRegistry();
    registry.register({
      id: "mock-editor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async () => {},
    });

    const listed = registry.list();
    const found = listed.find((t) => t.id === "mock-editor");
    expect(found).toBeTruthy();
    expect(found!.deployRoots).toEqual(expect.arrayContaining([".agents/skills", ".cursor"]));
    expect(registry.get("mock-editor")?.id).toBe("mock-editor");
    expect(registry.getAll()).toHaveLength(1);
  });

  test("register rejects incomplete target", () => {
    const registry = createTargetRegistry();
    expect(() =>
      registry.register({
        id: "",
        deployRoots: [],
        detect: () => true,
        materialize: async () => {},
      }),
    ).toThrow(/id/i);
  });

  test("detect evaluates registered targets once and records non-match diagnostics", async () => {
    const registry = createTargetRegistry();
    registry.register({
      id: "detected",
      deployRoots: [],
      detect: () => true,
      materialize: async () => {},
    });
    registry.register({
      id: "broken",
      deployRoots: [],
      detect: () => {
        throw new Error("not available");
      },
      materialize: async () => {},
    });

    await expect(registry.detect("/project")).resolves.toEqual({
      detectedIds: ["detected"],
      diagnostics: [{ targetId: "broken", message: 'Target "broken" detection did not match' }],
    });
  });
});
