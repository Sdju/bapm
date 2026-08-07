/**
 * Unit: CLI view parse + help (behavioural via parseViewArgs / formatViewHelp).
 */
import { describe, expect, test } from "vite-plus/test";
import { formatViewHelp, parseViewArgs } from "../../src/modules/View/index.ts";

const deps = {
  name: "bapm",
  manifestFile: "bapm.yml",
  lockFile: "bapm.lock.yaml",
};

describe("CLI view parse/help", () => {
  test("requires package positional", () => {
    const p = parseViewArgs([]);
    expect(p.error).toMatch(/package/i);
  });

  test("rejects extra versions positional", () => {
    const p = parseViewArgs(["acme/pkg", "versions"]);
    expect(p.error).toMatch(/Unexpected argument: versions/i);
  });

  test("rejects unknown flag", () => {
    const p = parseViewArgs(["acme/pkg", "--not-a-flag"]);
    expect(p.error).toMatch(/Unknown flag: --not-a-flag/i);
  });

  test("rejects --registry and -g", () => {
    expect(parseViewArgs(["pkg", "--registry"]).error).toMatch(/registry/i);
    expect(parseViewArgs(["pkg", "-g"]).error).toMatch(/-g|global/i);
  });

  test("--help / -h", () => {
    expect(parseViewArgs(["--help"]).help).toBe(true);
    expect(parseViewArgs(["-h"]).help).toBe(true);
  });

  test("help text mentions package and local/offline", () => {
    const text = formatViewHelp(deps);
    expect(text).toMatch(/<package>/i);
    expect(text).toMatch(/local|offline/i);
  });
});
