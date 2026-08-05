/**
 * Unit: p7a CLI parse for force / insecure / dev / only.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  formatInstallHelp,
  parseInstallArgs,
} from "../../src/modules/Install/services/runInstall.ts";

describe("p7a install CLI parse + help", () => {
  test("parse accepts force, allow-insecure, hosts, dev, only", () => {
    const parsed = parseInstallArgs(
      [
        "--force",
        "--allow-insecure",
        "--allow-insecure-host",
        "mirror.example.com",
        "--dev",
        "--only=mcp",
      ],
      { env: {} },
    );
    expect(parsed.error).toBeUndefined();
    expect(parsed.force).toBe(true);
    expect(parsed.allowInsecure).toBe(true);
    expect(parsed.allowInsecureHosts).toEqual(["mirror.example.com"]);
    expect(parsed.dev).toBe(true);
    expect(parsed.only).toBe("mcp");
  });

  test("rejects invalid --only and invalid host", () => {
    expect(parseInstallArgs(["--only", "lsp"], { env: {} }).error).toMatch(/only|apm|mcp/i);
    expect(
      parseInstallArgs(["--allow-insecure-host", "not a host"], { env: {} }).error,
    ).toMatch(/Invalid hostname|FQDN|bare hostname/i);
  });

  test("help lists p7a flags and omits --refresh", () => {
    const text = formatInstallHelp({
      name: "bapm",
      manifestFile: "bapm.yml",
      lockFile: "bapm.lock.yaml",
    });
    expect(text).toMatch(/--force\b/);
    expect(text).toMatch(/--allow-insecure\b/);
    expect(text).toMatch(/--allow-insecure-host\b/);
    expect(text).toMatch(/--dev\b/);
    expect(text).toMatch(/--only\b/);
    expect(text).toMatch(/does not refresh|does not bypass frozen or policy/i);
    expect(text).not.toMatch(/--refresh\b/);
  });
});
