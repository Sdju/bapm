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
});
