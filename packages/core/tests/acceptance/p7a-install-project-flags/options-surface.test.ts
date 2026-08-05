/**
 * p7a — RunInstallOptions surface for force / insecure / dev / only (no refresh).
 */
import { describe, expect, test } from "vite-plus/test";
import { readInstallTypesSource } from "./helpers.ts";

describe("p7a install options surface", () => {
  test("RunInstallOptions includes force, allowInsecure, hosts, dev, only; no refresh", () => {
    const src = readInstallTypesSource();
    // Bare `force` option — must not confuse with forceTarget / forcedTarget.
    expect(src).toMatch(/^\s*force\??\s*:/m);
    expect(src).toMatch(/^\s*allowInsecure\??\s*:/m);
    expect(src).toMatch(/^\s*allowInsecureHosts\??\s*:/m);
    expect(src).toMatch(/^\s*dev\??\s*:/m);
    expect(src).toMatch(/^\s*only\??\s*:/m);
    expect(src).toMatch(/\bforcedTarget\??\s*:|\bforceTarget\??\s*:/);
    expect(src).not.toMatch(/^\s*refresh\??\s*:/m);
  });
});
