/**
 * p7a — CLI install flags + help (cli-runtime-surface).
 * MUST: accept/help --force, --allow-insecure, --allow-insecure-host, --dev, --only;
 * omit --refresh; force ≠ refresh/frozen/policy bypass.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  BLOCK_DENY_LEAF,
  createTempProject,
  expectKnownCommand,
  expectKnownFlags,
  formatInstallHelp,
  parseInstallArgs,
  runCli,
  runInProject,
  withCapturedIo,
  writeLeafProject,
  writePolicy,
  type TempProject,
} from "./helpers.ts";

describe("p7a CLI install flags + help", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install help lists p7a flags, force semantics, and omits --refresh", async () => {
    const viaFlag = await withCapturedIo(() => runCli(["install", "--help"]));
    const viaHelp = await withCapturedIo(() => runCli(["help", "install"]));
    const text = [
      [...viaFlag.stdout, ...viaFlag.stderr].join("\n"),
      [...viaHelp.stdout, ...viaHelp.stderr].join("\n"),
      formatInstallHelp({ name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml" }),
    ].join("\n");

    expect(viaFlag.result === 0 || viaHelp.result === 0).toBe(true);
    expect(text).toMatch(/--force\b/);
    expect(text).toMatch(/--allow-insecure\b/);
    expect(text).toMatch(/--allow-insecure-host\b/);
    expect(text).toMatch(/--dev\b/);
    expect(text).toMatch(/--only\b/);
    expect(text).toMatch(/apm|mcp/i);
    // Force must not be conflated with refresh/update or frozen/policy bypass.
    expect(text).toMatch(/force[\s\S]{0,120}(refresh|frozen|policy)|does not (refresh|bypass)/i);
    expect(text).not.toMatch(/--refresh\b/);
    // Distinct from --target / forced-target.
    expect(text).toMatch(/--target\b/);
  });

  test("parseInstallArgs accepts force, allow-insecure, hosts, dev, only", () => {
    const parsed = parseInstallArgs(
      [
        "--force",
        "--allow-insecure",
        "--allow-insecure-host",
        "mirror.example.com",
        "--allow-insecure-host=other.example.org",
        "--dev",
        "--only",
        "apm",
        "--dry-run",
      ],
      { env: {} },
    );
    expect(parsed.error).toBeUndefined();
    expect((parsed as { force?: boolean }).force).toBe(true);
    expect((parsed as { allowInsecure?: boolean }).allowInsecure).toBe(true);
    expect((parsed as { allowInsecureHosts?: string[] }).allowInsecureHosts).toEqual(
      expect.arrayContaining(["mirror.example.com", "other.example.org"]),
    );
    expect((parsed as { dev?: boolean }).dev).toBe(true);
    expect((parsed as { only?: string }).only).toBe("apm");
    expect((parsed as { dryRun?: boolean }).dryRun).toBe(true);
  });

  test("new project-scope flags accepted on dry-run (not unknown)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-flags-ok", { withCursor: true });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--force",
      "--allow-insecure",
      "--allow-insecure-host",
      "mirror.example.com",
      "--dev",
      "--only",
      "apm",
      "--dry-run",
    ]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/Unknown install flag:\s*--force/i);
    expect(combined).not.toMatch(/Unknown install flag:\s*--allow-insecure/i);
    expect(combined).not.toMatch(/Unknown install flag:\s*--allow-insecure-host/i);
    expect(combined).not.toMatch(/Unknown install flag:\s*--dev/i);
    expect(combined).not.toMatch(/Unknown install flag:\s*--only/i);
    expect(result).toBe(0);
  });

  test("invalid --only value rejected fail-closed", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-only-bad", { withCursor: true });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--only",
      "lsp",
    ]);

    expectKnownCommand(combined, "install");
    // --only itself must be a known flag; only the value is invalid.
    expect(combined).not.toMatch(/Unknown install flag:\s*--only\b/i);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/--only|apm|mcp|invalid|choice|one of/i);
  });

  test("invalid allow-insecure-host rejected at parse", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-host-bad", { withCursor: true });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--allow-insecure-host",
      "not a host",
      "--dry-run",
    ]);

    expectKnownCommand(combined, "install");
    // Flag must be recognized; reject the token as a non-FQDN hostname.
    expect(combined).not.toMatch(/Unknown install flag:\s*--allow-insecure-host\b/i);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/Invalid hostname|FQDN|bare hostname|not a host/i);
  });

  test("--force does not bypass frozen missing-lock failure", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-force-frozen", { withCursor: true });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--force",
      "--frozen",
    ]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/frozen|lock/i);
  });

  test("--force does not disable blocking policy", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-force-policy", { withCursor: true });
    writePolicy(project.cwd, BLOCK_DENY_LEAF);

    const { result, combined } = await runInProject(project.cwd, ["install", "--force"]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/policy|deny|block|violat|denied/i);
  });
});
