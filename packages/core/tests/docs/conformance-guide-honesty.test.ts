/**
 * /guide/conformance honesty (promoted from mp-sc-claims): marketplace floor
 * exists; residual §10 security deferrals disclosed.
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync } from "node:fs";
import { conformanceGuidePath, readText } from "./helpers.ts";
import { limitationsNameResidualSecurity } from "../spec-conformance/sc-claims-helpers.ts";

describe("docs conformance guide honesty", () => {
  test("apps/docs/guide/conformance.md exists", () => {
    expect(existsSync(conformanceGuidePath), `expected ${conformanceGuidePath}`).toBe(true);
  });

  test("guide must not list marketplace/plugin as absolute OOS blanket", () => {
    const md = readText(conformanceGuidePath);

    expect(
      /\*\*marketplace\*\*\s*\/\s*\*\*plugin\*\*\s*surfaces/i.test(md) ||
        /marketplace\s*\/\s*plugin\s*surfaces/i.test(md),
      `guide still lists marketplace/plugin as absolute OOS:\n${md}`,
    ).toBe(false);
  });

  test("guide discloses residual §10 security-depth deferrals", () => {
    const md = readText(conformanceGuidePath);

    expect(
      limitationsNameResidualSecurity(md) ||
        /host.?class|AuthResolver|approve|deny|security.?depth|§\s*10/i.test(md),
      `guide must disclose residual security deferrals (host-auth / approve / soft §10):\n${md}`,
    ).toBe(true);
  });

  test("guide still lists multi-target and registry host as out of scope", () => {
    const md = readText(conformanceGuidePath);
    expect(md, "multi-target still OOS").toMatch(/multi-target/i);
    expect(md, "registry host still OOS").toMatch(/registry host/i);
  });
});
