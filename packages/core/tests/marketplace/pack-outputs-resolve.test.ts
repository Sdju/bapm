/**
 * Unit: resolve local / mocked ls-remote / offline fail / tag pattern.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  getResolveMarketplacePackages,
  type TempProject,
  writeBapmYml,
  writeText,
  join,
} from "./pack-outputs-helpers.ts";

describe("mp-pack-outputs unit resolve", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("local ./ package resolves without calling lsRemote", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      [
        `name: acme`,
        `version: "0.1.0"`,
        `marketplace:`,
        `  owner: acme`,
        `  outputs:`,
        `    claude: true`,
        `  packages:`,
        `    - name: demo`,
        `      source: ./plugins/demo`,
        ``,
      ].join("\n"),
    );
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");

    let called = false;
    const resolve = getResolveMarketplacePackages();
    const result = await Promise.resolve(
      resolve({
        cwd: project.cwd,
        lsRemote: async () => {
          called = true;
          return { sha: "a".repeat(40), ref: "main" };
        },
      }),
    );
    const list = Array.isArray(result)
      ? result
      : ((result as { packages?: unknown[] }).packages ?? []);
    expect(called).toBe(false);
    expect(list.length).toBe(1);
    expect((list[0] as { name: string }).name).toBe("demo");
  });

  test("github shorthand uses injectable lsRemote for ref+sha", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      [
        `name: acme`,
        `version: "0.1.0"`,
        `marketplace:`,
        `  owner: acme`,
        `  outputs:`,
        `    claude: true`,
        `  packages:`,
        `    - name: tools`,
        `      source: acme/tools`,
        `      ref: main`,
        ``,
      ].join("\n"),
    );

    const resolve = getResolveMarketplacePackages();
    const result = await Promise.resolve(
      resolve({
        cwd: project.cwd,
        lsRemote: async (_url: string, ref?: string) => ({
          sha: "b".repeat(40),
          ref: ref ?? "main",
        }),
      }),
    );
    const list = ((result as { packages?: Record<string, unknown>[] }).packages ?? []) as Record<
      string,
      unknown
    >[];
    expect(list[0]?.sha).toBe("b".repeat(40));
    expect(list[0]?.ref).toBe("main");
  });

  test("offline remote resolve fails closed", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      [
        `name: acme`,
        `version: "0.1.0"`,
        `marketplace:`,
        `  owner: acme`,
        `  outputs:`,
        `    claude: true`,
        `  packages:`,
        `    - name: tools`,
        `      source: acme/tools`,
        `      ref: main`,
        ``,
      ].join("\n"),
    );

    const resolve = getResolveMarketplacePackages();
    await expect(Promise.resolve(resolve({ cwd: project.cwd, offline: true }))).rejects.toThrow(
      /offline|network|resolve|ls-remote|ref|sha/i,
    );
  });
});
