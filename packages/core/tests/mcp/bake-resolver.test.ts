/**
 * Public-API MCP env/headers bake-time placeholders (promoted from mcp-env-bake-time).
 */
import { describe, expect, test } from "vite-plus/test";
import { bakeMap, expectBakeFailure } from "./bake-helpers.ts";

describe("mcp env bake resolver (public API)", () => {
  test("${VAR} bakes from process env / explicit env map", () => {
    const baked = bakeMap(
      { API_TOKEN: "${API_TOKEN}" },
      { env: { API_TOKEN: "literal-token-from-env" } },
    );
    expect(baked.API_TOKEN).toBe("literal-token-from-env");
    expect(baked.API_TOKEN).not.toContain("${");
  });

  test("${env:VAR} bakes equivalently", () => {
    const baked = bakeMap(
      { TOKEN: "${env:MY_TOKEN}" },
      { env: { MY_TOKEN: "env-prefix-token" } },
    );
    expect(baked.TOKEN).toBe("env-prefix-token");
  });

  test("legacy <VAR> angle placeholder bakes", () => {
    const baked = bakeMap({ TOKEN: "<MY_TOKEN>" }, { env: { MY_TOKEN: "angle-token" } });
    expect(baked.TOKEN).toBe("angle-token");
  });

  test("literals without placeholders pass through unchanged", () => {
    const baked = bakeMap(
      { FOO: "bar", PATH_LIKE: "/usr/bin/mcp" },
      { env: { FOO: "should-not-override-literal" } },
    );
    expect(baked).toEqual({ FOO: "bar", PATH_LIKE: "/usr/bin/mcp" });
  });

  test("multi-placeholder value resolves all matches", () => {
    const baked = bakeMap(
      { COMPOUND: "user=${USER_NAME};tok=${API_TOKEN}" },
      { env: { USER_NAME: "alice", API_TOKEN: "t-1" } },
    );
    expect(baked.COMPOUND).toBe("user=alice;tok=t-1");
  });

  test("overrides win over env; empty string is not a resolution", () => {
    const baked = bakeMap(
      { X: "${VAR}" },
      { overrides: { VAR: "from-override" }, env: { VAR: "from-env" } },
    );
    expect(baked.X).toBe("from-override");

    const message = expectBakeFailure(
      { X: "${EMPTY_VAR}" },
      { env: { EMPTY_VAR: "" }, overrides: {} },
    );
    expect(message).toMatch(/EMPTY_VAR/);
  });

  test("headers map bakes with the same placeholder syntaxes", () => {
    const baked = bakeMap(
      {
        Authorization: "Bearer ${API_TOKEN}",
        "X-Custom": "${env:HDR}",
        Legacy: "<LEGACY_HDR>",
      },
      {
        env: {
          API_TOKEN: "hdr-token",
          HDR: "custom-hdr",
          LEGACY_HDR: "legacy-hdr",
        },
      },
    );
    expect(baked.Authorization).toBe("Bearer hdr-token");
    expect(baked["X-Custom"]).toBe("custom-hdr");
    expect(baked.Legacy).toBe("legacy-hdr");
  });

  test("missing placeholder fail-closed names the var and never leaks secrets", () => {
    const secret = "super-secret-value-do-not-leak";
    const message = expectBakeFailure(
      { A: "${KNOWN_SECRET}", B: "${MISSING_SECRET}" },
      { env: { KNOWN_SECRET: secret } },
    );
    expect(message).toMatch(/MISSING_SECRET/);
    expect(message).not.toContain(secret);
  });
});
