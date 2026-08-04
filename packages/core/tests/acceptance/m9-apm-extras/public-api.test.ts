/**
 * M9 MUST: core public API surface for trust / compile / cache (TDD RED until apply).
 * Specs: executable-mcp-trust, compile-agents-md, cache-cli-ux, core-feod-architecture.
 */
import { expect, test, describe } from "vite-plus/test";
import {
  getCacheInfo,
  getCompileAgentsMd,
  getEvaluateExecutableTrust,
} from "./helpers.ts";

describe("core M9 public API (MUST exports)", () => {
  test("exports executable trust gate for sc-009", () => {
    const fn = getEvaluateExecutableTrust();
    expect(typeof fn).toBe("function");

    // Grant surface present + unapproved package → withhold / deny outcome.
    const result = fn({
      grantSurface: { allow: {} },
      packageName: "mcp-dep",
      executableType: "mcp",
    });
    const text = JSON.stringify(result);
    expect(text).toMatch(/withhold|deny|block|unapproved|false|not.?allow/i);
  });

  test("exports compile → AGENTS.md helper", () => {
    expect(typeof getCompileAgentsMd()).toBe("function");
  });

  test("exports cache info helper over modules-cache root", () => {
    expect(typeof getCacheInfo()).toBe("function");
  });
});
