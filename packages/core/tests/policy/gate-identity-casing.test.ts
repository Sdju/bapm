/**
 * Install/lock gate fails closed on mixed-case deny vs mixed-case identity.
 * Spec: policy-rule-evaluate + policy-install-gate under enforcement: block.
 * Promoted from acceptance/policy-canonical-identity-casing.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  getRunPolicyGate,
  hasRuleViolation,
  isBlocking,
  writePolicy,
  type TempProject,
} from "./helpers.ts";

const BLOCK_DENY_LOWERCASE = `name: deny-mixed-case
enforcement: block
dependencies:
  deny:
    - devexpgbb/**
`;

const BLOCK_ALLOW_MIXED = `name: allow-mixed-case
enforcement: block
dependencies:
  allow:
    - DevExpGbb/**
`;

describe("gate — identity casing fail-closed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("runPolicyGate blocks lowercase deny against mixed-case GitHub identity", () => {
    project = createTempProject();
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LOWERCASE);

    const gate = getRunPolicyGate()({
      cwd: project.cwd,
      candidates: [
        {
          id: "DevExpGbb/Secure-Baseline",
          name: "DevExpGbb/Secure-Baseline",
          host: "github.com",
          depth: 1,
          direct: true,
        },
      ],
      dependencies: [
        {
          id: "DevExpGbb/Secure-Baseline",
          name: "DevExpGbb/Secure-Baseline",
          depth: 1,
          direct: true,
        },
      ],
    });

    expect(isBlocking(gate)).toBe(true);
    expect(hasRuleViolation(gate, /deny|DevExpGbb|Secure-Baseline|violat/i)).toBe(true);
  });

  test("runPolicyGate allows mixed-case allow against lowercased GitHub identity", () => {
    project = createTempProject();
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_ALLOW_MIXED);

    const gate = getRunPolicyGate()({
      cwd: project.cwd,
      candidates: [
        {
          id: "devexpgbb/secure-baseline",
          name: "devexpgbb/secure-baseline",
          host: "github.com",
          depth: 1,
          direct: true,
        },
      ],
      dependencies: [
        {
          id: "devexpgbb/secure-baseline",
          name: "devexpgbb/secure-baseline",
          depth: 1,
          direct: true,
        },
      ],
    });

    expect(isBlocking(gate)).toBe(false);
    expect(hasRuleViolation(gate, /POLICY_ALLOW|not allowed|allow list/i)).toBe(false);
  });

  test("runPolicyGate deny-wins after fold on mixed-case Legacy", () => {
    project = createTempProject();
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: deny-wins
enforcement: block
dependencies:
  allow:
    - DevExpGbb/**
  deny:
    - devexpgbb/legacy
`,
    );

    const gate = getRunPolicyGate()({
      cwd: project.cwd,
      candidates: [
        {
          id: "DevExpGbb/Legacy",
          name: "DevExpGbb/Legacy",
          host: "github.com",
          depth: 1,
          direct: true,
        },
      ],
      dependencies: [{ id: "DevExpGbb/Legacy", name: "DevExpGbb/Legacy", depth: 1, direct: true }],
    });

    expect(isBlocking(gate)).toBe(true);
    expect(hasRuleViolation(gate, /deny|Legacy|legacy/i)).toBe(true);
  });
});
