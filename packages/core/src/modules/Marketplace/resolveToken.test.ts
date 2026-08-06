import { afterEach, describe, expect, test } from "vite-plus/test";
import { resolveTokenForHost } from "./resolveToken.ts";

describe("Marketplace resolveTokenForHost", () => {
  afterEach(() => {
    for (const k of [
      "GITHUB_TOKEN",
      "GH_TOKEN",
      "GITHUB_APM_PAT",
      "GITLAB_TOKEN",
      "GITLAB_APM_PAT",
      "ADO_APM_PAT",
    ]) {
      delete process.env[k];
    }
  });

  test("cross-class isolation", () => {
    process.env.GITHUB_TOKEN = "gh-secret";
    process.env.GITLAB_TOKEN = "gl-secret";
    process.env.ADO_APM_PAT = "ado-secret";

    expect(resolveTokenForHost("github.com")?.token).toBe("gh-secret");
    expect(resolveTokenForHost("github.com")?.source).toBe("GITHUB_TOKEN");
    expect(resolveTokenForHost("gitlab.com")?.token).toBe("gl-secret");
    expect(resolveTokenForHost("gitlab.com")?.source).toMatch(/GITLAB/);
    expect(resolveTokenForHost("dev.azure.com")?.token).toBe("ado-secret");
    expect(resolveTokenForHost("dev.azure.com")?.source).toBe("ADO_APM_PAT");
  });

  test("github token unused for gitlab/ado", () => {
    process.env.GITHUB_TOKEN = "gh-only";
    expect(resolveTokenForHost("gitlab.com")).toBeNull();
    expect(resolveTokenForHost("dev.azure.com")).toBeNull();
  });
});
