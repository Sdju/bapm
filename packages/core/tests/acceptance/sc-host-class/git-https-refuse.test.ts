/**
 * sc-008 — Refuse credential attach on non-https git-HTTP (loopback / insecure exempt).
 * Refusal still suppresses ambient tokens.
 */
import { describe, expect, test } from "vite-plus/test";
import { getBuildGitChildEnv } from "./helpers.ts";

const SECRET_GH = "ghp_SC_HOST_CLASS_HTTP_REFUSE_SECRET";

describe("sc-host-class https-only git-HTTP attach (sc-008)", () => {
  test("http remote does not get token attach and still suppresses ambient", () => {
    const build = getBuildGitChildEnv();
    const child = build({
      host: "example.com",
      url: "http://example.com/org/repo.git",
      env: {
        GITHUB_TOKEN: SECRET_GH,
        GH_TOKEN: SECRET_GH,
      },
      registries: {},
    });

    expect(child.GITHUB_TOKEN).toBeFalsy();
    expect(child.GH_TOKEN).toBeFalsy();
    const blob = JSON.stringify(child);
    expect(blob).not.toContain(SECRET_GH);
    // No Authorization / extraheader attach of the secret
    expect(blob).not.toMatch(new RegExp(`AUTHORIZATION[^\\n]*${SECRET_GH}`, "i"));
  });

  test("https remote may attach selected-class credential after suppress", () => {
    const build = getBuildGitChildEnv();
    const child = build({
      host: "github.com",
      url: "https://github.com/acme/tools.git",
      env: {
        GITHUB_TOKEN: SECRET_GH,
      },
    });

    expect(child.GITHUB_TOKEN).toBeFalsy(); // ambient cleared; attach is separate
    const blob = JSON.stringify(child);
    // Selected attach should surface the credential material somehow (header / GIT_CONFIG)
    expect(blob).toContain(SECRET_GH);
  });

  test("loopback http is exempt from non-https refuse", () => {
    const build = getBuildGitChildEnv();
    const child = build({
      host: "127.0.0.1",
      url: "http://127.0.0.1:8080/org/repo.git",
      env: {
        GITHUB_TOKEN: SECRET_GH,
        GITHUB_HOST: "127.0.0.1",
      },
    });

    // Scheme refuse must NOT block attach solely due to http on loopback.
    const blob = JSON.stringify(child);
    expect(blob).toContain(SECRET_GH);
  });

  test("insecure:true registry exemption allows http attach path", () => {
    const build = getBuildGitChildEnv();
    const child = build({
      host: "insecure.example.com",
      url: "http://insecure.example.com/org/repo.git",
      env: { GITHUB_TOKEN: SECRET_GH },
      registries: {
        local: {
          url: "http://insecure.example.com/v1",
          insecure: true,
        },
      },
    });

    const blob = JSON.stringify(child);
    expect(blob).toContain(SECRET_GH);
  });
});
