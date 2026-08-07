/**
 * sc-013 — Operator overlap (one effective class) + ambient suppress on git children.
 */
import { describe, expect, test } from "vite-plus/test";
import { getBuildGitChildEnv, getSelectProviderClassForHost, withEnv } from "./helpers.ts";

const SECRET_GH = "ghp_SC_HOST_CLASS_AMBIENT_GITHUB_SECRET";
const SECRET_ADO = "ado_SC_HOST_CLASS_AMBIENT_ADO_SECRET";
const SECRET_GL = "glpat_SC_HOST_CLASS_AMBIENT_GITLAB_SECRET";

describe("sc-host-class overlap + ambient suppress (sc-013)", () => {
  test("ADO_HOST wins over GITHUB_HOST on same FQDN", async () => {
    await withEnv(
      {
        ADO_HOST: "corp.example.com",
        APM_ADO_HOSTS: undefined,
        GITHUB_HOST: "corp.example.com",
        GITLAB_HOST: undefined,
        APM_GITLAB_HOSTS: undefined,
      },
      () => {
        const select = getSelectProviderClassForHost();
        const cls = String(select("corp.example.com", process.env)).toLowerCase();
        expect(cls).toMatch(/ado/);
        expect(cls).not.toMatch(/github|ghes|gitlab/);
      },
    );
  });

  test("GHES ∩ GitLab allowlist fails closed", async () => {
    await withEnv(
      {
        GITHUB_HOST: "overlap.example.com",
        GITLAB_HOST: "overlap.example.com",
        ADO_HOST: undefined,
      },
      () => {
        const select = getSelectProviderClassForHost();
        expect(() => select("overlap.example.com", process.env)).toThrow(
          /overlap|ambiguous|conflict/i,
        );
      },
    );
  });

  test("ado-selected git child does not inherit ambient GITHUB_TOKEN", async () => {
    const build = getBuildGitChildEnv();
    const child = build({
      host: "dev.azure.com",
      url: "https://dev.azure.com/org/project/_git/repo",
      env: {
        GITHUB_TOKEN: SECRET_GH,
        GH_TOKEN: SECRET_GH,
        ADO_APM_PAT: SECRET_ADO,
        GITLAB_TOKEN: SECRET_GL,
      },
    });

    expect(child.GITHUB_TOKEN, "ambient GITHUB_TOKEN must be suppressed").toBeFalsy();
    expect(child.GH_TOKEN, "ambient GH_TOKEN must be suppressed").toBeFalsy();
    expect(child.GITLAB_TOKEN, "unselected GitLab token must be suppressed").toBeFalsy();

    const blob = JSON.stringify(child);
    expect(blob).not.toContain(SECRET_GH);
    expect(blob).not.toContain(SECRET_GL);
    // Selected ado material may appear as attach (header / GIT_CONFIG_*), not as raw leak of unselected.
    expect(blob.includes(SECRET_ADO) || /ADO|EXTRAHEADER|AUTHORIZATION/i.test(blob)).toBe(true);
  });

  test("inherited http.extraheader Auth cleared for unselected class", async () => {
    const build = getBuildGitChildEnv();
    const child = build({
      host: "dev.azure.com",
      url: "https://dev.azure.com/org/project/_git/repo",
      env: {
        GITHUB_TOKEN: SECRET_GH,
        ADO_APM_PAT: SECRET_ADO,
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "http.extraheader",
        GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x:${SECRET_GH}`).toString("base64")}`,
      },
    });

    const values = Object.entries(child)
      .filter(([k]) => /GIT_CONFIG_VALUE/i.test(k) || /EXTRAHEADER/i.test(k))
      .map(([, v]) => String(v));
    const joined = values.join("\n");
    expect(joined).not.toContain(SECRET_GH);
    expect(JSON.stringify(child)).not.toContain(SECRET_GH);
  });

  test("selected-class credential attached only after suppress", async () => {
    const build = getBuildGitChildEnv();
    const child = build({
      host: "dev.azure.com",
      url: "https://dev.azure.com/org/project/_git/repo",
      env: {
        GITHUB_TOKEN: SECRET_GH,
        ADO_APM_PAT: SECRET_ADO,
      },
    });

    expect(child.GITHUB_TOKEN).toBeFalsy();
    const blob = JSON.stringify(child);
    expect(blob).not.toContain(SECRET_GH);
    // ado attach present somehow
    expect(blob).toContain(SECRET_ADO);
  });
});
