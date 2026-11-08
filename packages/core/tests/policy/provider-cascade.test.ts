/**
 * P2 parity — APM 0.35 policy discovery cascade:
 * GitHub `.github-private` → `.github` → `.apm` → `_apm`,
 * Azure DevOps `apm/apm-policy` → legacy `_apm/_apm`.
 *
 * Every fetcher is injected; these tests never touch the network.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { buildAdoPolicyApiUrl, isAzureDevOpsHost, parseAdoRepoFromRemoteUrl } from "@b-apm/core";
import {
  createTempProject,
  expectThrowsMatching,
  getDiscoverPolicyProviders,
  type TempProject,
} from "./helpers.ts";

const GITHUB_REMOTES = [{ name: "origin", url: "https://github.com/acme/app.git" }];
const GITHUB_POLICY = (repo: string) => `https://github.com/acme/${repo}/apm-policy.yml`;
const GITHUB_CANDIDATES = [".github-private", ".github", ".apm", "_apm"].map(GITHUB_POLICY);

const ADO_REMOTES = [{ name: "origin", url: "https://dev.azure.com/acme/Project/_git/app" }];
const ADO_PRIMARY =
  "https://dev.azure.com/acme/apm/_apis/git/repositories/apm-policy/items" +
  "?path=apm-policy.yml&versionDescriptor.version=main&api-version=7.0";
const ADO_LEGACY =
  "https://dev.azure.com/acme/_apm/_apis/git/repositories/_apm/items" +
  "?path=apm-policy.yml&versionDescriptor.version=main&api-version=7.0";

const POLICY_TEXT = `name: org-remote\nenforcement: block\ndependencies:\n  deny:\n    - leaf\n`;

type FetchResponse = string | { status: number } | Error;

function scriptedFetch(script: Record<string, FetchResponse>) {
  const calls: string[] = [];
  const fetcher = (url: string) => {
    calls.push(url);
    const value = script[url];
    if (value instanceof Error) throw value;
    if (value === undefined || typeof value === "object") {
      return { ok: false, status: value?.status ?? 404, url };
    }
    return { ok: true, status: 200, text: value, url };
  };
  return { calls, fetcher };
}

function discover(options: Record<string, unknown>) {
  return getDiscoverPolicyProviders()(options) as Record<string, unknown>;
}

describe("GitHub multi-candidate cascade (APM 0.35)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("tries .github-private → .github → .apm → _apm in order, absent when all 404", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({});

    const result = discover({
      cwd: project.cwd,
      providers: ["github-owner-dotgithub"],
      remotes: GITHUB_REMOTES,
      fetchPolicyUrl: fetcher,
    });

    expect(calls).toEqual(GITHUB_CANDIDATES);
    expect(result.absent).toBe(true);
  });

  test("first found wins and stops the cascade", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({
      [GITHUB_POLICY(".github")]: POLICY_TEXT,
      [GITHUB_POLICY("_apm")]: POLICY_TEXT,
    });

    const result = discover({
      cwd: project.cwd,
      providers: ["github-owner-dotgithub"],
      remotes: GITHUB_REMOTES,
      fetchPolicyUrl: fetcher,
    });

    expect(calls).toEqual([GITHUB_POLICY(".github-private"), GITHUB_POLICY(".github")]);
    expect(result.found).toBe(true);
    expect(result.provider).toBe("github-owner-dotgithub");
    expect(result.url).toBe(GITHUB_POLICY(".github"));
    expect((result.document as Record<string, unknown>).name).toBe("org-remote");
  });

  test(".github-private shadows later candidates", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({
      [GITHUB_POLICY(".github-private")]: POLICY_TEXT,
      [GITHUB_POLICY(".github")]: POLICY_TEXT,
    });

    const result = discover({
      cwd: project.cwd,
      providers: ["github-owner-dotgithub"],
      remotes: GITHUB_REMOTES,
      fetchPolicyUrl: fetcher,
    });

    expect(calls).toEqual([GITHUB_POLICY(".github-private")]);
    expect(result.url).toBe(GITHUB_POLICY(".github-private"));
  });

  test("non-404 fetch failure with fetch_failure:block aborts immediately", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({
      [GITHUB_POLICY(".github")]: { status: 503 },
    });

    const error = expectThrowsMatching(
      () =>
        discover({
          cwd: project.cwd,
          providers: ["github-owner-dotgithub"],
          remotes: GITHUB_REMOTES,
          fetchPolicyUrl: fetcher,
          defaultFetchFailure: "block",
        }),
      /fetch|block|503|policy/i,
    );
    expect(String((error as { code?: string }).code ?? "")).toBe("POLICY_FETCH_FAILURE");
    expect(calls).toEqual([GITHUB_POLICY(".github-private"), GITHUB_POLICY(".github")]);
  });

  test("network throw with fetch_failure:block aborts before trying next candidate", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({
      [GITHUB_POLICY(".github-private")]: new Error("network down"),
    });

    const error = expectThrowsMatching(
      () =>
        discover({
          cwd: project.cwd,
          providers: ["github-owner-dotgithub"],
          remotes: GITHUB_REMOTES,
          fetchPolicyUrl: fetcher,
          defaultFetchFailure: "block",
        }),
      /fetch|network|block/i,
    );
    expect(String((error as { code?: string }).code ?? "")).toBe("POLICY_FETCH_FAILURE");
    expect(calls).toEqual([GITHUB_POLICY(".github-private")]);
  });

  test("fetch_failure:warn treats a fetch error as absent without throwing", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({
      [GITHUB_POLICY(".github")]: { status: 503 },
    });

    const result = discover({
      cwd: project.cwd,
      providers: ["github-owner-dotgithub"],
      remotes: GITHUB_REMOTES,
      fetchPolicyUrl: fetcher,
      defaultFetchFailure: "warn",
    });

    expect(result.absent).toBe(true);
    expect(calls).toEqual([GITHUB_POLICY(".github-private"), GITHUB_POLICY(".github")]);
  });

  test("non-default host rejects the provider without inventing a convention", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({});

    const result = discover({
      cwd: project.cwd,
      providers: ["github-owner-dotgithub"],
      implementationDefaultHost: "github.com",
      remotes: [{ name: "origin", url: "https://gitlab.com/acme/app.git" }],
      fetchPolicyUrl: fetcher,
    });

    expect(calls).toEqual([]);
    expect(result.absent).toBe(true);
  });
});

describe("Azure DevOps org policy provider", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("derives org/project/repo and falls back from apm/apm-policy to legacy _apm/_apm", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({ [ADO_LEGACY]: POLICY_TEXT });

    const result = discover({
      cwd: project.cwd,
      providers: ["azure-devops-org-policy"],
      remotes: ADO_REMOTES,
      fetchPolicyUrl: fetcher,
    });

    expect(calls).toEqual([ADO_PRIMARY, ADO_LEGACY]);
    expect(result.found).toBe(true);
    expect(result.provider).toBe("azure-devops-org-policy");
    expect(result.url).toBe(ADO_LEGACY);
  });

  test("primary apm/apm-policy wins without touching the legacy coordinate", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({ [ADO_PRIMARY]: POLICY_TEXT });

    const result = discover({
      cwd: project.cwd,
      providers: ["azure-devops-org-policy"],
      remotes: ADO_REMOTES,
      fetchPolicyUrl: fetcher,
    });

    expect(calls).toEqual([ADO_PRIMARY]);
    expect(result.url).toBe(ADO_PRIMARY);
  });

  test("both ADO coordinates absent → absent", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({});

    const result = discover({
      cwd: project.cwd,
      providers: ["azure-devops-org-policy"],
      remotes: ADO_REMOTES,
      fetchPolicyUrl: fetcher,
    });

    expect(calls).toEqual([ADO_PRIMARY, ADO_LEGACY]);
    expect(result.absent).toBe(true);
  });

  test("ADO fetch failure blocks or warns according to fetch_failure", () => {
    project = createTempProject();
    const { fetcher } = scriptedFetch({ [ADO_PRIMARY]: { status: 500 } });

    const error = expectThrowsMatching(
      () =>
        discover({
          cwd: project.cwd,
          providers: ["azure-devops-org-policy"],
          remotes: ADO_REMOTES,
          fetchPolicyUrl: fetcher,
          defaultFetchFailure: "block",
        }),
      /fetch|block|500|policy/i,
    );
    expect(String((error as { code?: string }).code ?? "")).toBe("POLICY_FETCH_FAILURE");

    const warned = discover({
      cwd: project.cwd,
      providers: ["azure-devops-org-policy"],
      remotes: ADO_REMOTES,
      fetchPolicyUrl: fetcher,
      defaultFetchFailure: "warn",
    });
    expect(warned.absent).toBe(true);
  });

  test("ADO host-class pin rejects non-ADO and lookalike hosts without fetching", () => {
    project = createTempProject();
    for (const url of [
      "https://gitlab.com/acme/Project/_git/app",
      "https://dev.azure.com.evil.example/acme/Project/_git/app",
      "https://example.com/acme/Project/_git/app",
    ]) {
      const { calls, fetcher } = scriptedFetch({ [ADO_PRIMARY]: POLICY_TEXT });
      const result = discover({
        cwd: project.cwd,
        providers: ["azure-devops-org-policy"],
        remotes: [{ name: "origin", url }],
        fetchPolicyUrl: fetcher,
      });
      expect(calls, url).toEqual([]);
      expect(result.absent, url).toBe(true);
    }
  });

  test("default provider order discovers ADO when GitHub provider rejects the host", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({ [ADO_PRIMARY]: POLICY_TEXT });

    const result = discover({
      cwd: project.cwd,
      remotes: ADO_REMOTES,
      fetchPolicyUrl: fetcher,
    });

    expect(calls).toEqual([ADO_PRIMARY]);
    expect(result.found).toBe(true);
    expect(result.provider).toBe("azure-devops-org-policy");
  });

  test("on-prem ADO Server host can be allowlisted", () => {
    project = createTempProject();
    const { calls, fetcher } = scriptedFetch({});
    const url = "https://ado.corp.example.com/DefaultCollection/Project/_git/app";

    const result = discover({
      cwd: project.cwd,
      providers: ["azure-devops-org-policy"],
      remotes: [{ name: "origin", url }],
      adoHosts: ["ado.corp.example.com"],
      fetchPolicyUrl: fetcher,
    });

    expect(calls).toEqual([
      "https://ado.corp.example.com/DefaultCollection/apm/_apis/git/repositories/apm-policy/items" +
        "?path=apm-policy.yml&versionDescriptor.version=main&api-version=7.0",
      "https://ado.corp.example.com/DefaultCollection/_apm/_apis/git/repositories/_apm/items" +
        "?path=apm-policy.yml&versionDescriptor.version=main&api-version=7.0",
    ]);
    expect(result.absent).toBe(true);
  });
});

describe("Azure DevOps URL shapes", () => {
  test("https dev.azure.com clone URL", () => {
    const coords = parseAdoRepoFromRemoteUrl(
      "https://dev.azure.com/acme/My%20Project/_git/app.git",
    );
    expect(coords).toMatchObject({
      host: "dev.azure.com",
      apiHost: "dev.azure.com",
      org: "acme",
      project: "My Project",
      repo: "app",
    });
    expect(buildAdoPolicyApiUrl(coords!)).toBe(
      "https://dev.azure.com/acme/My%20Project/_apis/git/repositories/app/items" +
        "?path=apm-policy.yml&versionDescriptor.version=main&api-version=7.0",
    );
  });

  test("ssh.dev.azure.com v3 URL maps API host to dev.azure.com", () => {
    const coords = parseAdoRepoFromRemoteUrl("git@ssh.dev.azure.com:v3/acme/Project/app");
    expect(coords).toMatchObject({
      host: "ssh.dev.azure.com",
      apiHost: "dev.azure.com",
      org: "acme",
      project: "Project",
      repo: "app",
    });
    expect(buildAdoPolicyApiUrl(coords!)).toBe(
      "https://dev.azure.com/acme/Project/_apis/git/repositories/app/items" +
        "?path=apm-policy.yml&versionDescriptor.version=main&api-version=7.0",
    );
  });

  test("legacy *.visualstudio.com keeps org in the subdomain and omits org path", () => {
    const coords = parseAdoRepoFromRemoteUrl(
      "https://acme.visualstudio.com/DefaultCollection/Project/_git/app",
    );
    expect(coords).toMatchObject({
      host: "acme.visualstudio.com",
      org: "acme",
      project: "Project",
      repo: "app",
      legacyVisualStudio: true,
    });
    expect(buildAdoPolicyApiUrl(coords!)).toBe(
      "https://acme.visualstudio.com/Project/_apis/git/repositories/app/items" +
        "?path=apm-policy.yml&versionDescriptor.version=main&api-version=7.0",
    );
  });

  test("isAzureDevOpsHost accepts cloud/legacy/env hosts only", () => {
    expect(isAzureDevOpsHost("dev.azure.com")).toBe(true);
    expect(isAzureDevOpsHost("ssh.dev.azure.com")).toBe(true);
    expect(isAzureDevOpsHost("acme.visualstudio.com")).toBe(true);
    expect(isAzureDevOpsHost("ado.corp.example.com", { ADO_HOST: "ado.corp.example.com" })).toBe(
      true,
    );
    expect(isAzureDevOpsHost("github.com")).toBe(false);
    expect(isAzureDevOpsHost("dev.azure.com.evil.example")).toBe(false);
    expect(parseAdoRepoFromRemoteUrl("https://gitlab.com/acme/app.git")).toBeNull();
  });
});
