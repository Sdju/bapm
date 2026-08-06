/**
 * sc-003 — Resolve credentials per host class; never forward class A → class B.
 * Diagnostics use source id (sc-007 intact), not secret literals.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  getResolveCredentialsForHost,
  hasUsableToken,
  tokenPayload,
  withEnv,
} from "./helpers.ts";

const SECRET_GH = "ghp_SC_HOST_CLASS_GITHUB_SECRET_DO_NOT_LEAK";
const SECRET_REG = "bapm_SC_HOST_CLASS_REGISTRY_SECRET_DO_NOT_LEAK";

describe("sc-host-class resolve per class (sc-003)", () => {
  test("GitHub-class token unused for distinct registry host class", async () => {
    await withEnv(
      {
        GITHUB_TOKEN: SECRET_GH,
        GH_TOKEN: undefined,
        BAPM_REGISTRY_TOKEN: undefined,
      },
      () => {
        const resolve = getResolveCredentialsForHost();
        const got = resolve({
          host: "pkgs.example.com",
          url: "https://pkgs.example.com/v1/packages/x",
          env: process.env,
        });
        expect(
          hasUsableToken(got),
          `must not attach GitHub env to registry host class: ${JSON.stringify(got)}`,
        ).toBe(false);
        const { token } = tokenPayload(got);
        expect(token).not.toBe(SECRET_GH);
      },
    );
  });

  test("registry token unused for github.com request", async () => {
    await withEnv(
      {
        BAPM_REGISTRY_TOKEN: SECRET_REG,
        GITHUB_TOKEN: undefined,
        GH_TOKEN: undefined,
      },
      () => {
        const resolve = getResolveCredentialsForHost();
        const got = resolve({
          host: "github.com",
          url: "https://github.com/acme/tools.git",
          env: process.env,
        });
        expect(hasUsableToken(got)).toBe(false);
        const { token } = tokenPayload(got);
        expect(token).not.toBe(SECRET_REG);
      },
    );
  });

  test("diagnostic source id must not equal raw secret", async () => {
    await withEnv(
      {
        GITHUB_TOKEN: SECRET_GH,
        GH_TOKEN: undefined,
      },
      () => {
        const resolve = getResolveCredentialsForHost();
        const got = resolve({
          host: "github.com",
          url: "https://github.com/acme/tools.git",
          env: process.env,
        });
        expect(hasUsableToken(got)).toBe(true);
        const { source, token } = tokenPayload(got);
        expect(token).toBe(SECRET_GH);
        expect(source, "expected source id").toBeTruthy();
        expect(source).not.toBe(SECRET_GH);
        expect(source).not.toContain(SECRET_GH);
        const blob = JSON.stringify(got);
        expect(blob.includes(`"source":"${SECRET_GH}"`)).toBe(false);
        expect(blob.includes(`"sourceId":"${SECRET_GH}"`)).toBe(false);
      },
    );
  });

  test("non-default port narrows credential lookup within class (sc-013 e)", async () => {
    await withEnv(
      {
        BAPM_REGISTRY_TOKEN: SECRET_REG,
      },
      () => {
        const resolve = getResolveCredentialsForHost();
        const defaultPort = resolve({
          host: "pkgs.example.com",
          port: 443,
          url: "https://pkgs.example.com/v1",
          env: process.env,
          registries: {
            pkgs: { url: "https://pkgs.example.com/v1" },
          },
        });
        const customPort = resolve({
          host: "pkgs.example.com",
          port: 8443,
          url: "https://pkgs.example.com:8443/v1",
          env: process.env,
          registries: {
            pkgs: { url: "https://pkgs.example.com:8443/v1" },
          },
        });
        // Cache / identity keys must be distinct even when PSL class matches.
        const keyOf = (r: unknown): string => {
          if (r && typeof r === "object") {
            const o = r as Record<string, unknown>;
            if (typeof o.cacheKey === "string") return o.cacheKey;
            if (typeof o.scopeKey === "string") return o.scopeKey;
            if (typeof o.key === "string") return o.key;
            if (o.port !== undefined) return `port:${String(o.port)}`;
          }
          return JSON.stringify(r);
        };
        expect(keyOf(defaultPort)).not.toBe(keyOf(customPort));
      },
    );
  });
});
