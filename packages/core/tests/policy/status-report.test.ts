/**
 * Core `runPolicyStatus` outcomes, fields, redaction, read-only (P6d).
 * Specs: policy-status. Criteria: p6d-policy-status-criteria DoD.
 */
import { asText } from "../asText.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  RICH_LOCAL,
  MINIMAL_WARN,
  asReport,
  createTempProject,
  getRunPolicyStatus,
  projectFingerprint,
  ruleCountOf,
  writeLeafProject,
  writePolicy,
  writeText,
  join,
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

describe("p6d core runPolicyStatus — outcomes", () => {
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

  test("found local bapm-policy.yml reports usable posture + local provider", () => {
    project = createTempProject();
    const path = writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    expect(report.outcome).toBe("found");
    expect(asText(report.source ?? "")).toContain(path);
    expect(asText(report.provider)).toMatch(/local/i);
    expect(asText(report.enforcement)).toBe("block");
  });

  test("found local apm-policy.yml also reports found", () => {
    project = createTempProject();
    const path = writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN);

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    expect(report.outcome).toBe("found");
    expect(asText(report.source ?? "")).toContain(path);
    expect(asText(report.provider)).toMatch(/local/i);
    expect(asText(report.enforcement)).toBe("warn");
  });

  test("absent policy → outcome absent (no throw)", () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-absent");

    const report = asReport(
      getRunPolicyStatus()({
        cwd: project.cwd,
        // Keep remote discovery from inventing network side effects in unit fixtures.
        providers: ["local"],
        remotes: [],
        listGitRemotes: () => [],
      }),
    );
    expect(report.outcome).toBe("absent");
  });

  test("noPolicy escape → disabled (not absent)", () => {
    project = createTempProject();
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd, noPolicy: true }));
    expect(report.outcome).toBe("disabled");
    expect(asText(report.provider)).toMatch(/escap|none|disabled/i);
  });

  test("BAPM_POLICY_DISABLE=1 → disabled", () => {
    project = createTempProject();
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);
    process.env.BAPM_POLICY_DISABLE = "1";

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    expect(report.outcome).toBe("disabled");
  });

  test("APM_POLICY_DISABLE=1 → disabled", () => {
    project = createTempProject();
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);
    process.env.APM_POLICY_DISABLE = "1";

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    expect(report.outcome).toBe("disabled");
  });

  test("dual local files → error diagnostic without throw", () => {
    project = createTempProject();
    writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN);
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    expect(report.outcome).toBe("error");
    const blob = JSON.stringify(report);
    expect(blob).toMatch(/apm-policy\.yml/);
    expect(blob).toMatch(/bapm-policy\.yml/);
    expect(blob).toMatch(/conflict|both|dual/i);
  });

  test("explicit policyPath wins over sibling dual conflict", () => {
    project = createTempProject();
    const explicit = writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN);
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const report = asReport(
      getRunPolicyStatus()({
        cwd: project.cwd,
        policyPath: explicit,
        policy: explicit,
      }),
    );
    expect(report.outcome).toBe("found");
    expect(asText(report.source ?? "")).toContain(explicit);
    expect(asText(report.provider)).toMatch(/explicit|local/i);
    expect(asText(report.enforcement)).toBe("warn");
  });

  test("schema/load failure soft-maps to outcome error (no uncaught throw)", () => {
    project = createTempProject();
    writePolicy(project.cwd, "bapm-policy.yml", `name: bad\nenforcement: hard\n`);

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    expect(report.outcome).toBe("error");
    const blob = JSON.stringify(report.diagnostics ?? report);
    expect(blob).toMatch(/enforcement|invalid|hard|enum|validation/i);
  });

  test("extends fetch failure soft-maps to outcome error", () => {
    project = createTempProject();
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: child\nenforcement: warn\nfetch_failure: block\nextends: https://policy.example.com/missing.yml\n`,
    );

    const report = asReport(
      getRunPolicyStatus()({
        cwd: project.cwd,
        fetchPolicyUrl: () => ({
          ok: false,
          status: 503,
          url: "https://policy.example.com/missing.yml",
        }),
        httpGet: () => {
          throw new Error("HTTP 503");
        },
      }),
    );
    expect(report.outcome).toBe("error");
    const blob = JSON.stringify(report);
    expect(blob).toMatch(/fetch|503|extends|fail/i);
  });
});

describe("p6d core runPolicyStatus — stable fields", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("JSON-shaped report includes stable keys for found policy", () => {
    project = createTempProject();
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    for (const key of STABLE_KEYS) {
      expect(key in report, `missing stable key: ${key}`).toBe(true);
    }
    expect(Array.isArray(report.extends_chain)).toBe(true);
    expect(report.rule_counts && typeof report.rule_counts === "object").toBe(true);
    expect(Array.isArray(report.warnings) || report.warnings === undefined).toBe(true);
    expect(Array.isArray(report.diagnostics)).toBe(true);
  });

  test("rule_counts covers evaluated dependency families", () => {
    project = createTempProject();
    writePolicy(project.cwd, "bapm-policy.yml", RICH_LOCAL);

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    expect(ruleCountOf(report, "allow")).toBe(1);
    expect(ruleCountOf(report, "deny")).toBe(2);
    expect(ruleCountOf(report, "require")).toBe(1);
    expect(ruleCountOf(report, "max_depth")).toBeGreaterThan(0);
    expect(ruleCountOf(report, "require_pinned_constraint")).toBeGreaterThan(0);
  });

  test("extends_chain reflects resolved ancestor refs", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "parent.yml"),
      `name: parent\nenforcement: warn\ndependencies:\n  deny:\n    - leaf\n`,
    );
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: child\nextends: ./parent.yml\nenforcement: block\n`,
    );

    const report = asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    expect(report.outcome).toBe("found");
    expect(Array.isArray(report.extends_chain)).toBe(true);
    const chain = (report.extends_chain as unknown[]).map(String).join("\n");
    expect(chain).toMatch(/parent\.yml/);
    expect(asText(report.enforcement)).toBe("block");
  });

  test("credential-bearing source/extends refs are redacted", () => {
    project = createTempProject();
    const secretUrl =
      "https://alice:s3cr3t@policy.example.com/apm-policy.yml?sig=private-signature";
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: child\nenforcement: warn\nextends: ${secretUrl}\n`,
    );

    const report = asReport(
      getRunPolicyStatus()({
        cwd: project.cwd,
        fetchPolicyUrl: (url: string) => {
          if (asText(url).includes("policy.example.com")) {
            return {
              ok: true,
              text: `name: parent\nenforcement: warn\n`,
              url: secretUrl,
            };
          }
          return { ok: false, status: 404, url };
        },
        httpGet: () => ({
          ok: true,
          text: `name: parent\nenforcement: warn\n`,
          status: 200,
        }),
      }),
    );

    const blob = JSON.stringify(report);
    expect(blob).not.toMatch(/s3cr3t/);
    expect(blob).not.toMatch(/private-signature/);
    expect(blob).not.toMatch(/alice:/);
    expect(blob).toMatch(/policy\.example\.com|redact|\*\*\*/i);
  });
});

describe("p6d core runPolicyStatus — read-only", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("status does not mutate lock/modules/manifest fingerprints", () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6d-ro");
    writePolicy(project.cwd, "bapm-policy.yml", MINIMAL_WARN);
    writeText(join(project.cwd, "bapm.lock.yaml"), `lockfile_version: "1"\ndependencies: []\n`);
    writeText(join(project.cwd, "apm_modules", ".keep"), "keep\n");

    const before = projectFingerprint(project.cwd);
    asReport(getRunPolicyStatus()({ cwd: project.cwd }));
    const after = projectFingerprint(project.cwd);
    expect(after).toBe(before);
  });
});
