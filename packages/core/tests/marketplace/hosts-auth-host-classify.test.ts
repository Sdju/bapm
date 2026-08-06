/**
 * G1 — Marketplace host classification + GHES↔GitLab overlap fail-closed.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  getClassifyMarketplaceHost,
  getCreateMarketplaceSource,
  withEnv,
} from "./hosts-auth-helpers.ts";

describe("mp-hosts-auth host classification", () => {
  afterEach(async () => {
    // ensure env bleed does not leak across files if a test aborts mid-withEnv
    for (const k of ["GITHUB_HOST", "GITLAB_HOST", "APM_GITLAB_HOSTS"]) {
      delete process.env[k];
    }
  });

  test("github.com classifies as github-class / kind github", async () => {
    const create = getCreateMarketplaceSource();
    const src = create({
      name: "gh",
      url: "https://github.com/acme/tools.git",
    });
    expect(src.kind).toBe("github");

    const classify = getClassifyMarketplaceHost();
    const cls = String(classify("github.com")).toLowerCase();
    expect(cls).toMatch(/github/);
    expect(cls).not.toMatch(/gitlab|ado/);
  });

  test("gitlab.com classifies as gitlab", async () => {
    const create = getCreateMarketplaceSource();
    const src = create({
      name: "gl",
      url: "https://gitlab.com/acme/tools.git",
    });
    expect(src.kind).toBe("gitlab");

    const classify = getClassifyMarketplaceHost();
    expect(String(classify("gitlab.com")).toLowerCase()).toMatch(/gitlab/);
  });

  test("ado hosts classify as ado", async () => {
    const create = getCreateMarketplaceSource();
    const azure = create({
      name: "ado-a",
      url: "https://dev.azure.com/org/project/_git/repo",
    });
    expect(azure.kind).toBe("ado");

    const vs = create({
      name: "ado-b",
      url: "https://org.visualstudio.com/DefaultCollection/project/_git/repo",
    });
    expect(vs.kind).toBe("ado");

    const classify = getClassifyMarketplaceHost();
    expect(String(classify("dev.azure.com")).toLowerCase()).toMatch(/ado/);
  });

  test("*.ghe.com remains github kind (enterprise api_base is fetch concern)", async () => {
    const create = getCreateMarketplaceSource();
    const src = create({
      name: "ghe-cloud",
      url: "https://corp.ghe.com/acme/tools.git",
    });
    expect(src.kind).toBe("github");

    const classify = getClassifyMarketplaceHost();
    const cls = String(classify("corp.ghe.com")).toLowerCase();
    expect(cls).toMatch(/github|ghe/);
  });

  test("GITHUB_HOST marks GHES host as github-class (not generic git)", async () => {
    await withEnv({ GITHUB_HOST: "ghe.example.com", GITLAB_HOST: undefined }, () => {
      const create = getCreateMarketplaceSource();
      const src = create({
        name: "ghes",
        url: "https://ghe.example.com/acme/tools.git",
      });
      expect(src.kind).toBe("github");

      const classify = getClassifyMarketplaceHost();
      const cls = String(classify("ghe.example.com")).toLowerCase();
      expect(cls).toMatch(/github|ghes|ghe/);
      expect(cls).not.toBe("git");
    });
  });

  test("GITLAB_HOST allowlist classifies custom gitlab host", async () => {
    await withEnv({ GITLAB_HOST: "git.example.com", GITHUB_HOST: undefined }, () => {
      const create = getCreateMarketplaceSource();
      const src = create({
        name: "gl-self",
        url: "https://git.example.com/acme/tools.git",
      });
      expect(src.kind).toBe("gitlab");

      const classify = getClassifyMarketplaceHost();
      expect(String(classify("git.example.com")).toLowerCase()).toMatch(/gitlab/);
    });
  });

  test("GHES and GitLab overlap fails closed before token/network", async () => {
    await withEnv(
      {
        GITHUB_HOST: "overlap.example.com",
        GITLAB_HOST: "overlap.example.com",
      },
      () => {
        const classify = getClassifyMarketplaceHost();
        expect(() => classify("overlap.example.com")).toThrow(/overlap|conflict|ambiguous/i);

        const create = getCreateMarketplaceSource();
        expect(() =>
          create({
            name: "bad",
            url: "https://overlap.example.com/acme/tools.git",
          }),
        ).toThrow(/overlap|conflict|ambiguous/i);
      },
    );
  });
});
