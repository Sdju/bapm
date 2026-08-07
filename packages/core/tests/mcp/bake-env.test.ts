import { describe, expect, test } from "vite-plus/test";
import { bakeMcpStringMap, McpEnvBakeError } from "../../src/modules/Mcp/bake.ts";

describe("bakeMcpStringMap", () => {
  test("resolves ${VAR}, ${env:VAR}, and <VAR>", () => {
    expect(
      bakeMcpStringMap(
        {
          a: "${A}",
          b: "${env:B}",
          c: "<C>",
          d: "literal",
        },
        { env: { A: "1", B: "2", C: "3" } },
      ),
    ).toEqual({ a: "1", b: "2", c: "3", d: "literal" });
  });

  test("overrides beat env; empty values fail closed", () => {
    expect(bakeMcpStringMap({ X: "${V}" }, { overrides: { V: "o" }, env: { V: "e" } })).toEqual({
      X: "o",
    });
    expect(() => bakeMcpStringMap({ X: "${V}" }, { env: { V: "" } })).toThrow(McpEnvBakeError);
  });

  test("multi-placeholder and missing name in message without secret leak", () => {
    const secret = "do-not-print-me";
    expect(bakeMcpStringMap({ C: "u=${U};t=${T}" }, { env: { U: "alice", T: "tok" } })).toEqual({
      C: "u=alice;t=tok",
    });

    try {
      bakeMcpStringMap({ A: "${KNOWN}", B: "${MISSING}" }, { env: { KNOWN: secret } });
      expect.unreachable("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(McpEnvBakeError);
      expect((error as Error).message).toMatch(/MISSING/);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  test("resolves {bake:NAME} and {bake:env:NAME}", () => {
    expect(
      bakeMcpStringMap(
        {
          a: "{bake:A}",
          b: "{bake:env:B}",
          c: "Bearer {bake:TOKEN}",
        },
        { env: { A: "1", B: "2", TOKEN: "tok" } },
      ),
    ).toEqual({ a: "1", b: "2", c: "Bearer tok" });
  });

  test("{bake:NAME} missing fails closed; coexists with ${VAR}", () => {
    expect(
      bakeMcpStringMap(
        { FROM_APM: "${API_TOKEN}", FROM_BAKE: "{bake:API_TOKEN}" },
        { env: { API_TOKEN: "shared" } },
      ),
    ).toEqual({ FROM_APM: "shared", FROM_BAKE: "shared" });

    expect(
      bakeMcpStringMap(
        { COMPOUND: "user=${USER_NAME};tok={bake:API_TOKEN}" },
        { env: { USER_NAME: "alice", API_TOKEN: "t-1" } },
      ),
    ).toEqual({ COMPOUND: "user=alice;tok=t-1" });

    expect(() => bakeMcpStringMap({ X: "{bake:MISSING}" }, { env: {} })).toThrow(McpEnvBakeError);
    expect(() => bakeMcpStringMap({ X: "{bake:EMPTY}" }, { env: { EMPTY: "" } })).toThrow(
      McpEnvBakeError,
    );
  });
});
