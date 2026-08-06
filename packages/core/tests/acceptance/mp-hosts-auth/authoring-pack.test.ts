/**
 * G8 — Authoring check + pack resolve use thin auth for unlocked remotes.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempDir,
  getCheckMarketplaceAuthoring,
  getResolveMarketplacePackages,
  withEnv,
  writeText,
  join,
  type TempDir,
} from "./helpers.ts";

describe("mp-hosts-auth authoring check + pack resolve", () => {
  let tmp: TempDir | undefined;

  afterEach(() => {
    tmp?.cleanup();
    tmp = undefined;
    for (const k of ["GITLAB_TOKEN", "GITLAB_APM_PAT", "GITHUB_TOKEN", "GH_TOKEN"]) {
      delete process.env[k];
    }
  });

  test("online check probes unlocked gitlab when GitLab token present (not hosts-auth refuse)", async () => {
    tmp = createTempDir();
    writeText(
      join(tmp.path, "bapm.yml"),
      [
        `name: acme`,
        `version: "0.1.0"`,
        `marketplace:`,
        `  owner: acme-org`,
        `  packages:`,
        `    - name: tools`,
        `      source: gitlab.com/acme/tools`,
        `      ref: main`,
        ``,
      ].join("\n"),
    );

    await withEnv({ GITLAB_TOKEN: "glpat-CHECK_PROBE", GITHUB_TOKEN: undefined }, async () => {
      const check = getCheckMarketplaceAuthoring();
      let probed = 0;
      const result = await check({
        cwd: tmp!.path,
        offline: false,
        lsRemote: async (repoUrl: string) => {
          probed += 1;
          expect(repoUrl).toMatch(/gitlab\.com/i);
          // success — thin probe
        },
      });

      expect(probed, "must attempt online probe for gitlab with token").toBeGreaterThanOrEqual(1);
      expect(result.ok).toBe(true);
      expect(result.exitCode).toBe(0);
      const warnBlob = (result.warnings ?? []).join("\n");
      expect(warnBlob).not.toMatch(/hosts-auth unsupported|unsupported for this host/i);
    });
  });

  test("pack resolve unlocked gitlab remote with thin token / lsRemote", async () => {
    tmp = createTempDir();
    writeText(
      join(tmp.path, "bapm.yml"),
      [
        `name: acme`,
        `version: "0.1.0"`,
        `marketplace:`,
        `  owner: acme-org`,
        `  outputs:`,
        `    claude: true`,
        `  packages:`,
        `    - name: tools`,
        `      source: gitlab.com/acme/tools`,
        `      ref: main`,
        ``,
      ].join("\n"),
    );

    await withEnv({ GITLAB_TOKEN: "glpat-PACK_RESOLVE", GITHUB_TOKEN: undefined }, async () => {
      const resolve = getResolveMarketplacePackages();
      const sha = "c".repeat(40);
      const result = await resolve({
        cwd: tmp!.path,
        lsRemote: async (repoUrl: string, ref?: string) => {
          expect(repoUrl).toMatch(/gitlab\.com/i);
          return { sha, ref: ref ?? "main" };
        },
      });
      const list = Array.isArray(result)
        ? result
        : ((result as { packages?: Record<string, unknown>[] }).packages ?? []);
      expect(list.length).toBeGreaterThanOrEqual(1);
      const tools = list.find(
        (p) =>
          (p as { name?: string }).name === "tools" ||
          String((p as { source?: string }).source ?? "").includes("gitlab"),
      ) as { sha?: string; ref?: string } | undefined;
      expect(tools, `expected gitlab package in ${JSON.stringify(result)}`).toBeTruthy();
      expect(tools!.sha).toBe(sha);
      expect(tools!.ref).toBe("main");
    });
  });
});
