/**
 * Compatibility matrix must list Copilot-native registration as an in-boundary case.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./copilot-native-helpers.ts";

describe("agent-plugins compatibility — Copilot native registration", () => {
  test("compatibility-cases.json lists a Copilot-native registration case", () => {
    const casesPath = join(repoRoot, "tests/agent-plugins/compatibility-cases.json");
    expect(existsSync(casesPath)).toBe(true);
    const cases = JSON.parse(readFileSync(casesPath, "utf8")) as {
      components: Array<{ id: string; status: string; summary: string; test?: string }>;
      boundary?: string;
    };

    const copilotNative = cases.components.find(
      (c) =>
        /copilot/i.test(c.id) &&
        /native|registration|marketplace|apm_modules/i.test(`${c.id} ${c.summary}`),
    );
    expect(
      copilotNative,
      "expected a fixture-backed Copilot-native registration row in compatibility-cases.json",
    ).toBeTruthy();
    expect(["supported", "target-specific"]).toContain(copilotNative!.status);
    expect(copilotNative!.summary).toMatch(/catalog|ledger|settings|no copy|plugin-dir|native/i);
    expect(cases.boundary ?? "").toMatch(/portable|not an Agent Plugins certification|boundary/i);
  });

  test("AGENT_PLUGINS_COMPATIBILITY.md mentions Copilot-native registration", () => {
    const mdPath = join(repoRoot, "AGENT_PLUGINS_COMPATIBILITY.md");
    expect(existsSync(mdPath)).toBe(true);
    const md = readFileSync(mdPath, "utf8");
    expect(md).toMatch(/[Cc]opilot/);
    expect(md).toMatch(/native|registration|apm_modules|marketplace\.json|settings\.local/i);
  });
});
