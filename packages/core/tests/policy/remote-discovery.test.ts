/**
 * P4 — pl-012 remote selection + github-owner-dotgithub + pl-010 fetch_failure:block.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectThrowsMatching,
  getDiscoverPolicyProviders,
  getSelectProjectRemote,
  writePolicy,
  writeLeafProject,
  expectRejectsMatching,
  getRunInstall,
  hasModulesContent,
  type TempProject,
} from "./helpers.ts";

describe("P4 remote selection — pl-012", () => {
  test("origin preferred when present among remotes", () => {
    const selected = getSelectProjectRemote()({
      remotes: [
        { name: "upstream", url: "https://github.com/other/repo.git" },
        { name: "origin", url: "https://github.com/acme/app.git" },
      ],
      listGitRemotes: () => [
        { name: "upstream", url: "https://github.com/other/repo.git" },
        { name: "origin", url: "https://github.com/acme/app.git" },
      ],
    });
    const text = JSON.stringify(selected);
    expect(text).toMatch(/origin/i);
    expect(text).toMatch(/acme\/app/i);
  });

  test("single non-origin remote used", () => {
    const selected = getSelectProjectRemote()({
      remotes: [{ name: "fork", url: "https://github.com/acme/app.git" }],
      listGitRemotes: () => [{ name: "fork", url: "https://github.com/acme/app.git" }],
    });
    const text = JSON.stringify(selected);
    expect(text).toMatch(/fork|acme\/app/i);
  });

  test("multiple non-origin remotes fail closed naming candidates", () => {
    const err = expectThrowsMatching(
      () =>
        getSelectProjectRemote()({
          remotes: [
            { name: "a", url: "https://github.com/acme/a.git" },
            { name: "b", url: "https://github.com/acme/b.git" },
          ],
          listGitRemotes: () => [
            { name: "a", url: "https://github.com/acme/a.git" },
            { name: "b", url: "https://github.com/acme/b.git" },
          ],
        }),
      /remote|origin|ambiguous|multiple|candidate/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/a/);
    expect(text).toMatch(/b/);
  });

  test("no remotes skips remote discovery (null/absent)", () => {
    const selected = getSelectProjectRemote()({
      remotes: [],
      listGitRemotes: () => [],
    });
    if (selected === null || selected === undefined) {
      expect(selected == null).toBe(true);
      return;
    }
    const o = selected as Record<string, unknown>;
    expect(o.absent === true || o.skipped === true || o.remote == null).toBe(true);
  });
});

describe("P4 github-owner-dotgithub provider (pl-011)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("fetches owner/.github/apm-policy.yml on implementation-default host", () => {
    project = createTempProject();
    const remotePolicy = `name: org-remote\nenforcement: block\ndependencies:\n  deny:\n    - leaf\n`;

    const discovered = getDiscoverPolicyProviders()({
      cwd: project.cwd,
      providers: ["github-owner-dotgithub"],
      listGitRemotes: () => [{ name: "origin", url: "https://github.com/acme/app.git" }],
      fetchPolicyUrl: (url: string) => {
        if (
          /acme\/\.github|acme\/\.github\/apm-policy/i.test(url) ||
          /\/\.github\/apm-policy\.yml/.test(url)
        ) {
          return { ok: true, text: remotePolicy, url };
        }
        return { ok: false, status: 404, url };
      },
      httpGet: (url: string) => {
        if (/\/\.github\/apm-policy\.yml/.test(url)) {
          return { ok: true, body: remotePolicy, text: remotePolicy, url };
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    });

    const text = JSON.stringify(discovered);
    expect(text).toMatch(/org-remote|apm-policy|found|path|document/i);
    expect(text).not.toMatch(/"absent":\s*true/);
  });

  test("non-default host does not invent alternate host convention", () => {
    project = createTempProject();
    let fetched = false;
    const discovered = getDiscoverPolicyProviders()({
      cwd: project.cwd,
      providers: ["github-owner-dotgithub"],
      implementationDefaultHost: "github.com",
      listGitRemotes: () => [{ name: "origin", url: "https://gitlab.com/acme/app.git" }],
      fetchPolicyUrl: () => {
        fetched = true;
        return { ok: true, text: "name: x\nenforcement: warn\n" };
      },
      httpGet: () => {
        fetched = true;
        return { ok: true, body: "name: x\nenforcement: warn\n" };
      },
    });

    expect(fetched).toBe(false);
    const text = JSON.stringify(discovered);
    expect(text).toMatch(/absent|skip|empty|null|\[\]/i);
  });
});

describe("P4 fetch_failure block — remote / transitive extends (pl-010)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("remote fetch failure with fetch_failure block aborts install before modules", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p4-remote-fail");
    // No local policy — force remote provider path with injectable failure.
    await expectRejectsMatching(
      () =>
        getRunInstall()({
          cwd: project.cwd,
          policyProviders: ["github-owner-dotgithub"],
          providers: ["github-owner-dotgithub"],
          listGitRemotes: () => [{ name: "origin", url: "https://github.com/acme/app.git" }],
          fetchPolicyUrl: () => {
            throw new Error("network down");
          },
          httpGet: () => {
            throw new Error("network down");
          },
          // Effective fetch_failure:block (default remote org policy posture).
          defaultFetchFailure: "block",
        }),
      /fetch|network|policy|block|fail/i,
    );
    expect(hasModulesContent(project.cwd)).toBe(false);
  });

  test("transitive extends fetch failure with block aborts before modules", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p4-extends-fail");
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: leaf\nextends: missing-org/missing-policy\nenforcement: block\nfetch_failure: block\n`,
    );

    await expectRejectsMatching(
      () =>
        getRunInstall()({
          cwd: project.cwd,
          fetchAncestor: () => {
            throw new Error("extends fetch failed");
          },
          fetchPolicyUrl: () => {
            throw new Error("extends fetch failed");
          },
        }),
      /fetch|extends|policy|block|fail|not found|missing/i,
    );
    expect(hasModulesContent(project.cwd)).toBe(false);
  });
});
