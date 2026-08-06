/**
 * Unit tests for Auth credential host-class / aliases / overlap / port (sc-host-class).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  buildGitChildEnv,
  credentialHostClassOf,
  mayAttachGitCredential,
  resolveCredentialsForHost,
  sameCredentialHostClass,
  selectProviderClassForHost,
} from "./index.ts";

describe("Auth credentialHostClassOf (PSL)", () => {
  test("same eTLD+1", () => {
    expect(credentialHostClassOf("api.github.com")).toBe(credentialHostClassOf("github.com"));
  });

  test("co.uk multi-part suffix", () => {
    expect(credentialHostClassOf("a.example.co.uk")).toBe("example.co.uk");
    expect(credentialHostClassOf("a.other.co.uk")).toBe("other.co.uk");
  });

  test("github.io private suffix", () => {
    expect(credentialHostClassOf("alice.github.io")).toBe("alice.github.io");
    expect(credentialHostClassOf("bob.github.io")).toBe("bob.github.io");
  });
});

describe("Auth aliases + overlap + port", () => {
  test("aliases union", () => {
    const registries = {
      pkgs: { url: "https://pkgs.example.com/v1", aliases: ["mirror.example.net"] },
    };
    expect(sameCredentialHostClass("mirror.example.net", "pkgs.example.com", { registries })).toBe(
      true,
    );
  });

  test("ADO wins overlap", () => {
    expect(
      selectProviderClassForHost("corp.example.com", {
        ADO_HOST: "corp.example.com",
        GITHUB_HOST: "corp.example.com",
      }),
    ).toBe("ado");
  });

  test("port-scoped cache keys", () => {
    const env = { BAPM_REGISTRY_TOKEN: "tok" };
    const registries = {
      pkgs: { url: "https://pkgs.example.com/v1" },
    };
    const a = resolveCredentialsForHost({
      host: "pkgs.example.com",
      port: 443,
      url: "https://pkgs.example.com/v1",
      env,
      registries,
    });
    const b = resolveCredentialsForHost({
      host: "pkgs.example.com",
      port: 8443,
      url: "https://pkgs.example.com:8443/v1",
      env,
      registries: { pkgs: { url: "https://pkgs.example.com:8443/v1" } },
    });
    expect(a?.cacheKey).not.toBe(b?.cacheKey);
  });
});

describe("Auth git child env", () => {
  test("ado-selected blanks GitHub tokens", () => {
    const child = buildGitChildEnv({
      host: "dev.azure.com",
      url: "https://dev.azure.com/org/project/_git/repo",
      env: {
        GITHUB_TOKEN: "gh-secret",
        ADO_APM_PAT: "ado-secret",
      },
    });
    expect(child.GITHUB_TOKEN).toBeFalsy();
    expect(JSON.stringify(child)).toContain("ado-secret");
    expect(JSON.stringify(child)).not.toContain("gh-secret");
  });

  test("http refuse / https attach / loopback exempt", () => {
    expect(
      mayAttachGitCredential({
        host: "example.com",
        url: "http://example.com/r.git",
      }),
    ).toBe(false);
    expect(
      mayAttachGitCredential({
        host: "github.com",
        url: "https://github.com/a/b.git",
      }),
    ).toBe(true);
    expect(
      mayAttachGitCredential({
        host: "127.0.0.1",
        url: "http://127.0.0.1/r.git",
      }),
    ).toBe(true);
  });
});
