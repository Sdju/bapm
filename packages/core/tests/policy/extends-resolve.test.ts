/**
 * P4 — pl-003 extends depth/cycle + valid chain; fixtures valid-extends / invalid-extends-cycle.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  expectThrowsMatching,
  fixturePath,
  getParsePolicy,
  getResolvePolicyChain,
  policyOf,
  readText,
  writePolicy,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("P4 extends resolve — depth / cycle (pl-003)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("valid short relative chain merges into one effective document", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "parent.yml"),
      `name: parent\nenforcement: warn\ndependencies:\n  deny:\n    - leaf\n`,
    );
    const leafPath = writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: child\nextends: ./parent.yml\nenforcement: block\n`,
    );

    const resolve = getResolvePolicyChain();
    const result = resolve({
      cwd: project.cwd,
      path: leafPath,
      leafPath,
    });
    const effective = policyOf(result);
    expect(String(effective.enforcement)).toBe("block");
    const deny = (effective.dependencies as { deny?: string[] } | undefined)?.deny ?? [];
    expect(deny.map(String)).toContain("leaf");
  });

  test("depth exceeding five rejected with depth diagnostic", () => {
    project = createTempProject();
    // Chain: leaf → p1 → p2 → p3 → p4 → p5 → p6 (6 extends hops beyond leaf = >5 layers).
    writeText(join(project.cwd, "p6.yml"), `name: p6\nenforcement: warn\n`);
    writeText(join(project.cwd, "p5.yml"), `name: p5\nextends: ./p6.yml\nenforcement: warn\n`);
    writeText(join(project.cwd, "p4.yml"), `name: p4\nextends: ./p5.yml\nenforcement: warn\n`);
    writeText(join(project.cwd, "p3.yml"), `name: p3\nextends: ./p4.yml\nenforcement: warn\n`);
    writeText(join(project.cwd, "p2.yml"), `name: p2\nextends: ./p3.yml\nenforcement: warn\n`);
    writeText(join(project.cwd, "p1.yml"), `name: p1\nextends: ./p2.yml\nenforcement: warn\n`);
    const leaf = writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: leaf\nextends: ./p1.yml\nenforcement: warn\n`,
    );

    expectThrowsMatching(
      () => getResolvePolicyChain()({ cwd: project.cwd, path: leaf, leafPath: leaf }),
      /depth|exceed|max.*5|too deep|chain/i,
    );
  });

  test("self-extends cycle rejected naming cycle members", () => {
    project = createTempProject();
    const leaf = writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: cycle-leaf\nextends: ./bapm-policy.yml\nenforcement: warn\n`,
    );

    const err = expectThrowsMatching(
      () => getResolvePolicyChain()({ cwd: project.cwd, path: leaf, leafPath: leaf }),
      /cycle|circular|loop/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/cycle-leaf|bapm-policy/i);
  });

  test("Mode B invalid-extends-cycle.yml rejected with cycle diagnostic", () => {
    const path = fixturePath("policy/invalid-extends-cycle.yml");
    expectThrowsMatching(
      () =>
        getResolvePolicyChain()({
          cwd: fixturePath("policy"),
          path,
          leafPath: path,
        }),
      /cycle|circular|loop/i,
    );
  });

  test("Mode B valid-extends.yml resolves owner/repo via injectable fetcher", () => {
    const path = fixturePath("policy/valid-extends.yml");
    const leafRaw = readText(path);
    const parse = getParsePolicy();
    // Precondition: parse retains extends (schema-level).
    const parsed = policyOf(
      parse({ name: "x", extends: "contoso-enterprise/policy", enforcement: "block" }),
    );
    expect(String(parsed.extends)).toBe("contoso-enterprise/policy");

    const parentDoc = {
      name: "contoso-enterprise",
      enforcement: "warn",
      dependencies: { deny: ["*/legacy-*"], require: ["contoso/security-baseline"] },
    };

    const result = getResolvePolicyChain()({
      cwd: fixturePath("policy"),
      path,
      leafPath: path,
      leafYaml: leafRaw,
      fetchAncestor: (ref: string) => {
        if (ref === "contoso-enterprise/policy" || /contoso-enterprise\/policy/.test(ref)) {
          return { document: parentDoc, policy: parentDoc, source: ref };
        }
        throw new Error(`unexpected extends ref: ${ref}`);
      },
    });

    const effective = policyOf(result);
    expect(String(effective.enforcement)).toBe("block");
    expect(String(effective.name)).toMatch(/contoso/i);
  });
});
