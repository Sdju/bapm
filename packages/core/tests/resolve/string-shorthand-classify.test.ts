/**
 * README / docs contract: string shorthand is org/repo[+#ref], not org/repo/subdir.
 * Nested package path requires object form git + path (virtual_path companion).
 */
import { describe, expect, test } from "vite-plus/test";
import { classifyDependencyRef } from "@b-apm/core";

describe("Resolver string shorthand (README contract)", () => {
  test("org/repo maps to github.com URL", () => {
    expect(classifyDependencyRef("mycompany/ai-tools")).toMatchObject({
      kind: "git-literal",
      git: "https://github.com/mycompany/ai-tools",
    });
  });

  test("org/repo#ref keeps ref; multi-segment string is NOT virtual_path", () => {
    expect(classifyDependencyRef("org/repo#v1.0.0")).toMatchObject({
      git: "https://github.com/org/repo",
      ref: "v1.0.0",
    });
    const nested = classifyDependencyRef("anthropics/skills/skills/frontend-design");
    expect(nested).toMatchObject({
      kind: "git-literal",
      git: "https://github.com/anthropics/skills/skills/frontend-design",
    });
    expect(nested).not.toHaveProperty("path");
    expect(nested).not.toHaveProperty("virtual_path");
  });

  test("git + path object form carries virtual companion path", () => {
    expect(
      classifyDependencyRef({
        git: "https://github.com/anthropics/skills",
        path: "skills/frontend-design",
      }),
    ).toMatchObject({
      git: "https://github.com/anthropics/skills",
      path: "skills/frontend-design",
    });
  });

  test("path: ./local stays local", () => {
    expect(classifyDependencyRef({ path: "./my/local-plugin" })).toMatchObject({
      kind: "local",
      path: "./my/local-plugin",
    });
  });
});
