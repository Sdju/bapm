/**
 * Unit: resolve local / mocked ls-remote / offline fail / tag pattern.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  getResolveMarketplacePackages,
  type TempProject,
  writeBapmYml,
  writeText,
  join,
} from "./pack-outputs-helpers.ts";
import {
  defaultLsRemote,
  listRemoteTags,
} from "../../src/modules/Marketplace/modules/PackOutputs/resolve.ts";

const tagRepos: string[] = [];

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "bapm test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "bapm test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

type TagRepo = {
  dir: string;
  branch: string;
  annotatedCommit: string;
  annotatedTagObject: string;
  lightweightCommit: string;
};

/** Local repo with annotated v1.0.0 on commit 1 and lightweight v1.1.0 on commit 2. */
function createTagRepo(): TagRepo {
  const dir = mkdtempSync(join(tmpdir(), "bapm-pack-tags-"));
  tagRepos.push(dir);
  runGit(dir, ["init", "-q", "-b", "main"]);
  writeFileSync(join(dir, "README.md"), "# demo\n");
  runGit(dir, ["add", "."]);
  runGit(dir, ["commit", "-qm", "one"]);
  const annotatedCommit = runGit(dir, ["rev-parse", "HEAD"]);
  runGit(dir, ["tag", "-a", "v1.0.0", "-m", "annotated"]);
  const annotatedTagObject = runGit(dir, ["rev-parse", "v1.0.0"]);

  writeFileSync(join(dir, "README.md"), "# demo v1.1.0\n");
  runGit(dir, ["commit", "-qam", "two"]);
  runGit(dir, ["tag", "v1.1.0"]);
  const lightweightCommit = runGit(dir, ["rev-parse", "HEAD"]);
  const branch = runGit(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);

  return { dir, branch, annotatedCommit, annotatedTagObject, lightweightCommit };
}

/** Force a GitHub URL to resolve to a local repo without network. */
function rewriteGitUrl(url: string, targetDir: string): () => void {
  const saved = {
    count: process.env.GIT_CONFIG_COUNT,
    key: process.env.GIT_CONFIG_KEY_0,
    value: process.env.GIT_CONFIG_VALUE_0,
  };
  process.env.GIT_CONFIG_COUNT = "1";
  process.env.GIT_CONFIG_KEY_0 = `url.file://${targetDir}.insteadOf`;
  process.env.GIT_CONFIG_VALUE_0 = url;
  return () => {
    for (const [name, value] of [
      ["GIT_CONFIG_COUNT", saved.count],
      ["GIT_CONFIG_KEY_0", saved.key],
      ["GIT_CONFIG_VALUE_0", saved.value],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

describe("mp-pack-outputs unit resolve", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
    while (tagRepos.length > 0) rmSync(tagRepos.pop()!, { recursive: true, force: true });
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

  test("listRemoteTags peels annotated tags and keeps lightweight tags", async () => {
    const repo = createTagRepo();
    const tags = await listRemoteTags(repo.dir);
    expect(tags.get("v1.0.0")).toBe(repo.annotatedCommit);
    expect(tags.get("v1.0.0")).not.toBe(repo.annotatedTagObject);
    expect(tags.get("v1.1.0")).toBe(repo.lightweightCommit);
  });

  test("defaultLsRemote peels annotated refs to the commit", async () => {
    const repo = createTagRepo();
    const annotated = await defaultLsRemote(repo.dir, "v1.0.0");
    expect(annotated.sha).toBe(repo.annotatedCommit);
    expect(annotated.sha).not.toBe(repo.annotatedTagObject);
    expect(annotated.ref).toBe("v1.0.0");
  });

  test("defaultLsRemote keeps lightweight tag and branch refs unchanged", async () => {
    const repo = createTagRepo();
    const lightweight = await defaultLsRemote(repo.dir, "v1.1.0");
    expect(lightweight.sha).toBe(repo.lightweightCommit);
    expect(lightweight.ref).toBe("v1.1.0");

    const branch = await defaultLsRemote(repo.dir, repo.branch);
    expect(branch.sha).toBe(repo.lightweightCommit);
    expect(branch.ref).toBe(repo.branch);
  });

  test("resolver uses peeled commit for an annotated tag ref", async () => {
    const repo = createTagRepo();
    const restore = rewriteGitUrl("https://github.com/acme/tools.git", repo.dir);
    try {
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
          `      ref: v1.0.0`,
          ``,
        ].join("\n"),
      );

      const resolve = getResolveMarketplacePackages();
      const result = await Promise.resolve(resolve({ cwd: project.cwd }));
      const list = ((result as { packages?: Record<string, unknown>[] }).packages ?? []) as Record<
        string,
        unknown
      >[];
      expect(list[0]?.sha).toBe(repo.annotatedCommit);
      expect(list[0]?.sha).not.toBe(repo.annotatedTagObject);
      expect(list[0]?.ref).toBe("v1.0.0");
    } finally {
      restore();
    }
  });

  test("resolver uses peeled commit for an annotated version tag", async () => {
    const repo = createTagRepo();
    const restore = rewriteGitUrl("https://github.com/acme/tools.git", repo.dir);
    try {
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
          `      version: "1.0.0"`,
          ``,
        ].join("\n"),
      );

      const resolve = getResolveMarketplacePackages();
      const result = await Promise.resolve(resolve({ cwd: project.cwd }));
      const list = ((result as { packages?: Record<string, unknown>[] }).packages ?? []) as Record<
        string,
        unknown
      >[];
      expect(list[0]?.sha).toBe(repo.annotatedCommit);
      expect(list[0]?.sha).not.toBe(repo.annotatedTagObject);
      expect(list[0]?.ref).toBe("v1.0.0");
    } finally {
      restore();
    }
  });

  test("resolver rejects an abbreviated SHA instead of emitting source.sha", async () => {
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
        `      ref: abc1234`,
        ``,
      ].join("\n"),
    );

    const resolve = getResolveMarketplacePackages();
    await expect(
      Promise.resolve(
        resolve({
          cwd: project.cwd,
          lsRemote: async () => ({ sha: "abc1234", ref: "abc1234" }),
        }),
      ),
    ).rejects.toThrow(/abbreviated|40-character|sha/i);
  });

  test("resolver rejects an abbreviated SHA ref from git", async () => {
    const repo = createTagRepo();
    const restore = rewriteGitUrl("https://github.com/acme/tools.git", repo.dir);
    try {
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
          `      ref: ${repo.annotatedCommit.slice(0, 7)}`,
          ``,
        ].join("\n"),
      );

      const resolve = getResolveMarketplacePackages();
      await expect(Promise.resolve(resolve({ cwd: project.cwd }))).rejects.toThrow(
        /ls-remote|not found|sha/i,
      );
    } finally {
      restore();
    }
  });
});
