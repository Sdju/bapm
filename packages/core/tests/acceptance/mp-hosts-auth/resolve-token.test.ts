/**
 * G5/G6 — Thin env token resolve by host class + cross-class isolation.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  getResolveTokenForHost,
  hasUsableToken,
  tokenPayload,
  withEnv,
} from "./helpers.ts";

const SECRET_GH = "ghp_ACCEPTANCE_GITHUB_SECRET_DO_NOT_LEAK";
const SECRET_GL = "glpat-ACCEPTANCE_GITLAB_SECRET_DO_NOT_LEAK";
const SECRET_ADO = "ado_ACCEPTANCE_ADO_SECRET_DO_NOT_LEAK";

describe("mp-hosts-auth thin resolveTokenForHost", () => {
  test("GitHub token unused for gitlab host", async () => {
    await withEnv(
      {
        GITHUB_TOKEN: SECRET_GH,
        GH_TOKEN: undefined,
        GITLAB_TOKEN: undefined,
        GITLAB_APM_PAT: undefined,
        ADO_APM_PAT: undefined,
      },
      () => {
        const resolve = getResolveTokenForHost();
        const got = resolve("gitlab.com");
        expect(hasUsableToken(got), `must not select GitHub env for gitlab: ${JSON.stringify(got)}`).toBe(
          false,
        );
        const { token } = tokenPayload(got);
        expect(token).not.toBe(SECRET_GH);
      },
    );
  });

  test("GitHub token unused for ado host", async () => {
    await withEnv(
      {
        GITHUB_TOKEN: SECRET_GH,
        GH_TOKEN: SECRET_GH,
        GITLAB_TOKEN: SECRET_GL,
        ADO_APM_PAT: undefined,
      },
      () => {
        const resolve = getResolveTokenForHost();
        const got = resolve("dev.azure.com");
        expect(hasUsableToken(got)).toBe(false);
        const { token } = tokenPayload(got);
        expect(token).not.toBe(SECRET_GH);
        expect(token).not.toBe(SECRET_GL);
      },
    );
  });

  test("ADO uses ADO_APM_PAT only (ignores GitHub/GitLab env)", async () => {
    await withEnv(
      {
        ADO_APM_PAT: SECRET_ADO,
        GITHUB_TOKEN: SECRET_GH,
        GH_TOKEN: SECRET_GH,
        GITLAB_TOKEN: SECRET_GL,
        GITLAB_APM_PAT: SECRET_GL,
      },
      () => {
        const resolve = getResolveTokenForHost();
        const got = resolve("dev.azure.com");
        expect(hasUsableToken(got)).toBe(true);
        const { token, source } = tokenPayload(got);
        expect(token).toBe(SECRET_ADO);
        if (source) {
          expect(source).toMatch(/ADO/i);
          expect(source).not.toMatch(/GITHUB|GITLAB|GH_TOKEN/i);
        }
      },
    );
  });

  test("GitLab env for gitlab host", async () => {
    await withEnv(
      {
        GITLAB_TOKEN: SECRET_GL,
        GITLAB_APM_PAT: undefined,
        GITHUB_TOKEN: SECRET_GH,
        GH_TOKEN: undefined,
        ADO_APM_PAT: undefined,
      },
      () => {
        const resolve = getResolveTokenForHost();
        const got = resolve("gitlab.com");
        expect(hasUsableToken(got)).toBe(true);
        const { token, source } = tokenPayload(got);
        expect(token).toBe(SECRET_GL);
        if (source) {
          expect(source).toMatch(/GITLAB/i);
          expect(source).not.toMatch(/GITHUB|ADO|GH_TOKEN/i);
        }
      },
    );
  });

  test("GitHub-class host uses GITHUB_TOKEN / GH_TOKEN", async () => {
    await withEnv(
      {
        GITHUB_TOKEN: SECRET_GH,
        GH_TOKEN: undefined,
        GITLAB_TOKEN: SECRET_GL,
        ADO_APM_PAT: SECRET_ADO,
      },
      () => {
        const resolve = getResolveTokenForHost();
        const got = resolve("github.com");
        expect(hasUsableToken(got)).toBe(true);
        const { token } = tokenPayload(got);
        expect(token).toBe(SECRET_GH);
        expect(token).not.toBe(SECRET_GL);
        expect(token).not.toBe(SECRET_ADO);
      },
    );
  });

  test("diagnostic source id must not equal raw secret", async () => {
    await withEnv({ GITHUB_TOKEN: SECRET_GH, GH_TOKEN: undefined }, () => {
      const resolve = getResolveTokenForHost();
      const got = resolve("github.com");
      const blob = JSON.stringify(got);
      const { source } = tokenPayload(got);
      if (source) {
        expect(source).not.toBe(SECRET_GH);
        expect(source).not.toContain(SECRET_GH);
      }
      // source id field itself must not be the secret; token field may hold it
      expect(blob.includes(`"source":"${SECRET_GH}"`)).toBe(false);
      expect(blob.includes(`"sourceId":"${SECRET_GH}"`)).toBe(false);
    });
  });
});
