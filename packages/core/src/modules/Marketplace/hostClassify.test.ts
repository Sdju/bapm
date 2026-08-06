import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  classifyMarketplaceHost,
  classifyMarketplaceHostKind,
  githubApiBaseForHost,
} from "./hostClassify.ts";

describe("Marketplace hostClassify", () => {
  afterEach(() => {
    for (const k of ["GITHUB_HOST", "GITLAB_HOST", "APM_GITLAB_HOSTS"]) {
      delete process.env[k];
    }
  });

  test("matrix kinds", () => {
    expect(classifyMarketplaceHost("github.com")).toBe("github");
    expect(classifyMarketplaceHost("corp.ghe.com")).toBe("ghe_cloud");
    expect(classifyMarketplaceHost("gitlab.com")).toBe("gitlab");
    expect(classifyMarketplaceHost("dev.azure.com")).toBe("ado");
    expect(classifyMarketplaceHost("git.example.invalid")).toBe("generic");
    expect(classifyMarketplaceHostKind("gitlab.com")).toBe("gitlab");
  });

  test("GITHUB_HOST / GITLAB_HOST allowlists + overlap", () => {
    process.env.GITHUB_HOST = "ghe.example.com";
    expect(classifyMarketplaceHost("ghe.example.com")).toBe("ghes");
    expect(classifyMarketplaceHostKind("ghe.example.com")).toBe("github");

    delete process.env.GITHUB_HOST;
    process.env.GITLAB_HOST = "git.example.com";
    expect(classifyMarketplaceHost("git.example.com")).toBe("gitlab");

    process.env.GITHUB_HOST = "overlap.example.com";
    process.env.GITLAB_HOST = "overlap.example.com";
    expect(() => classifyMarketplaceHost("overlap.example.com")).toThrow(/overlap|conflict/i);
  });

  test("api base for github vs GHE", () => {
    expect(githubApiBaseForHost("github.com")).toBe("https://api.github.com");
    expect(githubApiBaseForHost("corp.ghe.com")).toBe("https://corp.ghe.com/api/v3");
    process.env.GITHUB_HOST = "ghe.example.com";
    expect(githubApiBaseForHost("ghe.example.com")).toBe("https://ghe.example.com/api/v3");
  });
});
