/**
 * CLI `bapm policy status` exit contract, JSON, redaction, read-only (P6d).
 * Specs: cli-runtime-surface, policy-status.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  MINIMAL_WARN,
  RICH_LOCAL,
  createTempProject,
  expectKnownCommand,
  join,
  parseJsonStdout,
  projectFingerprint,
  runInProject,
  stdoutText,
  writeLeafProject,
  writePolicy,
  writeText,
  type TempProject,
} from "./helpers.ts";

const STABLE_KEYS = [
  "outcome",
  "source",
  "provider",
  "enforcement",
  "extends_chain",
  "rule_counts",
  "warnings",
  "diagnostics",
] as const;

describe("p6d CLI policy status", () => {
  let project: TempProject;
  const prevBapm = process.env.BAPM_POLICY_DISABLE;
  const prevApm = process.env.APM_POLICY_DISABLE;

  afterEach(() => {
    project?.cleanup();
    if (prevBapm === undefined) delete process.env.BAPM_POLICY_DISABLE;
    else process.env.BAPM_POLICY_DISABLE = prevBapm;
    if (prevApm === undefined) delete process.env.APM_POLICY_DISABLE;
    else process.env.APM_POLICY_DISABLE = prevApm;
  });

  test("found local policy exits 0 and reports source + enforcement", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-found");
    const path = writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const { result, combined } = await runInProject(project.cwd, ["policy", "status"]);
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);
    expect(combined).toMatch(/found/i);
    expect(combined).toMatch(/block/i);
    expect(combined).toMatch(/bapm-policy\.yml|local/i);
    expect(combined).toContain("bapm-policy.yml");
    void path;
  });

  test("absent policy exits 0 with absent posture", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-absent");

    const { result, combined } = await runInProject(project.cwd, ["policy", "status"]);
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);
    expect(combined).toMatch(/absent/i);
  });

  test("--no-policy reports disabled/escaped and exits 0", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-escape");
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const { result, combined } = await runInProject(project.cwd, [
      "policy",
      "status",
      "--no-policy",
    ]);
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);
    expect(combined).toMatch(/disabled|escap/i);
    expect(combined).not.toMatch(/\babsent\b/i);
  });

  test("BAPM_POLICY_DISABLE=1 reports disabled and exits 0", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-env");
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);
    process.env.BAPM_POLICY_DISABLE = "1";

    const { result, combined } = await runInProject(project.cwd, ["policy", "status"]);
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);
    expect(combined).toMatch(/disabled|escap/i);
  });

  test("--policy path uses that source and exits 0", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-explicit");
    writePolicy(project.cwd, "apm-policy.yml", RICH_LOCAL);
    const warnPath = writePolicy(project.cwd, "override-policy.yml", MINIMAL_WARN);

    const { result, combined } = await runInProject(project.cwd, [
      "policy",
      "status",
      "--policy",
      warnPath,
    ]);
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);
    expect(combined).toMatch(/found|warn/i);
    expect(combined).toMatch(/override-policy\.yml/);
  });

  test("dual local conflict exits 0 with diagnostic error outcome", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-dual");
    writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN);
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const { result, combined } = await runInProject(project.cwd, ["policy", "status"]);
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);
    expect(combined).toMatch(/error|conflict|both/i);
    expect(combined).toMatch(/apm-policy\.yml/);
    expect(combined).toMatch(/bapm-policy\.yml/);
  });

  test("--check fails when absent (no usable policy)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-check-absent");

    const { result, combined } = await runInProject(project.cwd, ["policy", "status", "--check"]);
    expectKnownCommand(combined, "policy");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/absent|disabled|error|no usable|not found/i);
  });

  test("--check fails when disabled via --no-policy", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-check-disabled");
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const { result, combined } = await runInProject(project.cwd, [
      "policy",
      "status",
      "--no-policy",
      "--check",
    ]);
    expectKnownCommand(combined, "policy");
    expect(result).not.toBe(0);
  });

  test("--check succeeds when usable policy is found", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-check-ok");
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const { result, combined } = await runInProject(project.cwd, ["policy", "status", "--check"]);
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);
    expect(combined).toMatch(/found/i);
  });

  test("--json emits stable keys for found policy", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-json");
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "policy",
      "status",
      "--json",
    ]);
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);

    const doc = parseJsonStdout(stdout);
    for (const key of STABLE_KEYS) {
      expect(key in doc, `missing stable key: ${key}`).toBe(true);
    }
    expect(doc.outcome).toBe("found");
    expect(String(doc.enforcement)).toBe("block");
    expect(Array.isArray(doc.extends_chain)).toBe(true);
    expect(doc.rule_counts && typeof doc.rule_counts === "object").toBe(true);

    // ASCII-safe deterministic: no smart quotes / emoji in machine JSON
    const body = stdoutText(stdout);
    for (const ch of body) {
      if (ch === "\n" || ch === "\r" || ch === "\t") continue;
      const cp = ch.codePointAt(0) ?? 0;
      expect(cp >= 0x20 && cp <= 0x7e, `non-ASCII in JSON: U+${cp.toString(16)}`).toBe(true);
    }
  });

  test("credential-bearing extends refs are redacted in human + JSON", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-redact");
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: child\nenforcement: warn\nextends: https://alice:s3cr3t@policy.example.com/base.yml?sig=private-signature\n`,
    );

    const human = await runInProject(project.cwd, ["policy", "status"]);
    expectKnownCommand(human.combined, "policy");
    expect(human.combined).not.toMatch(/s3cr3t/);
    expect(human.combined).not.toMatch(/private-signature/);

    const json = await runInProject(project.cwd, ["policy", "status", "--json"]);
    expectKnownCommand(json.combined, "policy");
    expect(json.combined).not.toMatch(/s3cr3t/);
    expect(json.combined).not.toMatch(/private-signature/);
  });

  test("status does not mutate lock or modules", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-cli-ro");
    writePolicy(project.cwd, "bapm-policy.yml", MINIMAL_WARN);
    writeText(join(project.cwd, "bapm.lock.yaml"), `lockfile_version: "1"\ndependencies: []\n`);
    writeText(join(project.cwd, "apm_modules", ".keep"), "keep\n");

    const before = projectFingerprint(project.cwd);
    const { result, combined } = await runInProject(project.cwd, ["policy", "status"]);
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);
    expect(projectFingerprint(project.cwd)).toBe(before);
  });
});
