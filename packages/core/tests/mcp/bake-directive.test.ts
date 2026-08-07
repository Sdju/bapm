/**
 * Public-API MCP `{bake:NAME}` / `{bake:env:NAME}` bake directive
 * (promoted from mcp-bake-directive).
 */
import { describe, expect, test } from "vite-plus/test";
import { bakeMap, expectBakeFailure } from "./bake-helpers.ts";

describe("mcp bake directive resolver (public API)", () => {
  test("{bake:NAME} bakes from process env / explicit env map", () => {
    const baked = bakeMap(
      { API_TOKEN: "{bake:API_TOKEN}" },
      { env: { API_TOKEN: "literal-token-from-env" } },
    );
    expect(baked.API_TOKEN).toBe("literal-token-from-env");
    expect(baked.API_TOKEN).not.toContain("{bake:");
  });

  test("{bake:env:NAME} bakes equivalently", () => {
    const baked = bakeMap(
      { TOKEN: "{bake:env:MY_TOKEN}" },
      { env: { MY_TOKEN: "env-prefix-token" } },
    );
    expect(baked.TOKEN).toBe("env-prefix-token");
    expect(baked.TOKEN).not.toContain("{bake:");
  });

  test("unresolved {bake:NAME} fails closed naming NAME without leaking secrets", () => {
    const secret = "super-secret-value-do-not-leak";
    const message = expectBakeFailure(
      { A: "{bake:KNOWN_SECRET}", B: "{bake:MISSING}" },
      { env: { KNOWN_SECRET: secret } },
    );
    expect(message).toMatch(/MISSING/);
    expect(message).not.toContain(secret);
    expect(message).not.toMatch(/\{bake:MISSING\}/);
  });

  test("empty env value for {bake:NAME} is not a resolution", () => {
    const message = expectBakeFailure(
      { X: "{bake:EMPTY_VAR}" },
      { env: { EMPTY_VAR: "" }, overrides: {} },
    );
    expect(message).toMatch(/EMPTY_VAR/);
  });

  test("overrides win over env for {bake:NAME}", () => {
    const baked = bakeMap(
      { X: "{bake:VAR}" },
      { overrides: { VAR: "from-override" }, env: { VAR: "from-env" } },
    );
    expect(baked.X).toBe("from-override");
  });

  test("headers map bakes {bake:NAME} and {bake:env:NAME}", () => {
    const baked = bakeMap(
      {
        Authorization: "Bearer {bake:API_TOKEN}",
        "X-Custom": "{bake:env:HDR}",
      },
      {
        env: {
          API_TOKEN: "hdr-token",
          HDR: "custom-hdr",
        },
      },
    );
    expect(baked.Authorization).toBe("Bearer hdr-token");
    expect(baked["X-Custom"]).toBe("custom-hdr");
  });

  test("APM ${VAR} still bakes unchanged alongside bake directive", () => {
    const baked = bakeMap(
      {
        FROM_APM: "${API_TOKEN}",
        FROM_BAKE: "{bake:API_TOKEN}",
      },
      { env: { API_TOKEN: "shared-token" } },
    );
    expect(baked.FROM_APM).toBe("shared-token");
    expect(baked.FROM_BAKE).toBe("shared-token");
  });

  test("compound value resolves both APM and {bake:} tokens", () => {
    const baked = bakeMap(
      { COMPOUND: "user=${USER_NAME};tok={bake:API_TOKEN}" },
      { env: { USER_NAME: "alice", API_TOKEN: "t-1" } },
    );
    expect(baked.COMPOUND).toBe("user=alice;tok=t-1");
  });
});
