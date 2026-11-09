import { join, resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  hasDeployRoot,
  requireDeployRoots,
  resolveEnvHome,
  resolveXdgConfigHome,
  stripJsonc,
} from "../src/index.ts";

describe("hasDeployRoot", () => {
  test("matches exact and nested roots", () => {
    expect(hasDeployRoot([".agents/skills"], ".agents")).toBe(true);
    expect(hasDeployRoot([".cursor"], ".cursor")).toBe(true);
    expect(hasDeployRoot(["./.cursor/"], ".cursor")).toBe(true);
  });

  test("is segment-aware", () => {
    expect(hasDeployRoot([".cursorrules"], ".cursor")).toBe(false);
    expect(hasDeployRoot([".agents-extra"], ".agents")).toBe(false);
  });

  test("treats dot as the project root only", () => {
    expect(hasDeployRoot(["."], ".")).toBe(true);
    expect(hasDeployRoot(["./"], ".")).toBe(true);
    expect(hasDeployRoot([".cursor"], ".")).toBe(false);
  });
});

describe("requireDeployRoots", () => {
  test("throws the historical message for a missing root", () => {
    expect(() => requireDeployRoots([".cursor"], [".cursor", ".agents"], "cursor")).toThrow(
      "cursor target missing .agents deploy root",
    );
  });

  test("accepts nested declarations", () => {
    expect(() => requireDeployRoots([".agents/skills"], [".agents"], "agent-skills")).not.toThrow();
  });
});

describe("resolveEnvHome", () => {
  test("uses the env override when present", () => {
    expect(
      resolveEnvHome("BAPM_TEST_HOME", [".fallback"], {
        env: { BAPM_TEST_HOME: "/tmp/custom-home" },
        home: "/home/tester",
      }),
    ).toBe("/tmp/custom-home");
  });

  test("falls back under the provided home", () => {
    expect(
      resolveEnvHome("BAPM_TEST_HOME", [".hermes"], {
        env: {},
        home: "/home/tester",
      }),
    ).toBe(join("/home/tester", ".hermes"));
  });
});

describe("resolveXdgConfigHome", () => {
  test("honors an absolute override", () => {
    expect(resolveXdgConfigHome({ env: { XDG_CONFIG_HOME: "/tmp/xdg" }, home: "/home/t" })).toBe(
      "/tmp/xdg",
    );
  });

  test("rejects a relative override", () => {
    expect(() =>
      resolveXdgConfigHome({ env: { XDG_CONFIG_HOME: "relative" }, home: "/home/t" }),
    ).toThrow(/absolute/);
  });

  test("can resolve a relative override when the caller opts in", () => {
    expect(
      resolveXdgConfigHome({
        env: { XDG_CONFIG_HOME: "relative" },
        home: "/home/t",
        allowRelative: true,
      }),
    ).toBe(resolve("relative"));
  });

  test("falls back to ~/.config", () => {
    expect(resolveXdgConfigHome({ env: {}, home: "/home/t" })).toBe(join("/home/t", ".config"));
  });
});

describe("stripJsonc", () => {
  test("strips comments and trailing commas without touching strings", () => {
    const source = `{
      // line comment
      "url": "https://example.test/*not-a-comment*/",
      /* block */
      "items": [1, 2,],
    }`;
    const parsed = JSON.parse(stripJsonc(source)) as {
      url: string;
      items: number[];
    };
    expect(parsed.url).toBe("https://example.test/*not-a-comment*/");
    expect(parsed.items).toEqual([1, 2]);
  });
});
