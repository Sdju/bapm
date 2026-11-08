/**
 * `noRepoPolicy` (`--no-policy`) skips repository-local policy only.
 * Org/remote deny and org `executables.deny` / `deny_all` must still apply.
 * `noPolicy` stays the full escape (`--no-policy-all` / env disable).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  BLOCK_DENY_LEAF_POLICY,
  createTempProject,
  expectRejectsMatching,
  getRunInstall,
  getRunPolicyGate,
  hasLockFile,
  hasModulesContent,
  writeLeafProject,
  writePolicy,
  writeText,
  type TempProject,
} from "./helpers.ts";

const REMOTES = [{ name: "origin", url: "https://github.com/acme/app.git" }];

const ORG_DENY_LEAF_POLICY = `name: org-deny-leaf
enforcement: block
dependencies:
  deny:
    - leaf
`;

const ORG_DENY_ALL_EXECUTABLES = `name: org-deny-all
enforcement: block
executables:
  deny_all: true
`;

/** Inject org policy discovery without touching the network. */
function remotePolicyArgs(text: string) {
  return {
    remotes: REMOTES,
    listGitRemotes: () => REMOTES,
    fetchPolicyUrl: (url: string) => {
      if (url === "https://github.com/acme/.github/apm-policy.yml") {
        return { ok: true, text, url };
      }
      return { ok: false, status: 404, url };
    },
  };
}

const LEAF_CANDIDATES = [
  {
    id: "leaf",
    name: "leaf",
    ref: "leaf",
    direct: true,
    depth: 1,
  },
];

const LEAF_DEPENDENCIES = [
  {
    name: "leaf",
    id: "leaf",
    ref: "leaf",
    direct: true,
    depth: 1,
  },
];

function writeMcpGrantProject(cwd: string, name: string): void {
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}
version: 0.0.1
executables:
  allow:
    leaf:
      mcp: true
dependencies:
  apm:
    - path: ./leaf
`,
  );
  writeText(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf
version: 0.0.1
dependencies:
  mcp:
    - name: org-blocked
      registry: false
      transport: stdio
      command: echo
`,
  );
}

describe("noRepoPolicy — repository-local skip keeps org policy", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("ignores local deny but still evaluates org deny", () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "no-repo-org");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    const gate = getRunPolicyGate()({
      cwd: project.cwd,
      noRepoPolicy: true,
      candidates: LEAF_CANDIDATES,
      dependencies: LEAF_DEPENDENCIES,
      ...remotePolicyArgs(ORG_DENY_LEAF_POLICY),
    }) as Record<string, unknown>;

    expect(gate.blocking).toBe(true);
    expect(String(gate.sourcePath)).toMatch(/^https:\/\/github\.com\/acme\/\.github\//);
  });

  test("local deny alone is ignored with noRepoPolicy", () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "no-repo-local-only");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    const gate = getRunPolicyGate()({
      cwd: project.cwd,
      noRepoPolicy: true,
      candidates: LEAF_CANDIDATES,
      dependencies: LEAF_DEPENDENCIES,
      remotes: [],
      listGitRemotes: () => [],
    }) as Record<string, unknown>;

    expect(gate.blocking).toBe(false);
    expect(gate.skipped).toBe(true);
    expect(gate.absent).toBe(true);
  });

  test("explicit --policy still wins over noRepoPolicy", () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "no-repo-explicit");
    const local = writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    const gate = getRunPolicyGate()({
      cwd: project.cwd,
      noRepoPolicy: true,
      policyPath: local,
      policy: local,
      candidates: LEAF_CANDIDATES,
      dependencies: LEAF_DEPENDENCIES,
      remotes: [],
      listGitRemotes: () => [],
    }) as Record<string, unknown>;

    expect(gate.blocking).toBe(true);
    expect(String(gate.sourcePath)).toContain("bapm-policy.yml");
  });

  test("install with local deny + org deny rejects with noRepoPolicy", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "no-repo-install-org");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    await expectRejectsMatching(
      () =>
        getRunInstall()({
          cwd: project.cwd,
          noRepoPolicy: true,
          ...remotePolicyArgs(ORG_DENY_LEAF_POLICY),
        }),
      /policy|deny|block|violat|denied/i,
    );
    expect(hasModulesContent(project.cwd)).toBe(false);
  });

  test("install with no org policy proceeds with noRepoPolicy", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "no-repo-install-local");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    await getRunInstall()({
      cwd: project.cwd,
      noRepoPolicy: true,
      remotes: [],
      listGitRemotes: () => [],
    });
    expect(hasModulesContent(project.cwd) || hasLockFile(project.cwd)).toBe(true);
  });

  test("install with local deny + org deny proceeds with noPolicy full escape", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "no-repo-install-all");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    await getRunInstall()({
      cwd: project.cwd,
      noPolicy: true,
      ...remotePolicyArgs(ORG_DENY_LEAF_POLICY),
    });
    expect(hasModulesContent(project.cwd) || hasLockFile(project.cwd)).toBe(true);
  });
});

describe("noRepoPolicy — org executables floor still applies", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("ignores local executables deny_all and deploys granted MCP", async () => {
    project = createTempProject();
    writeMcpGrantProject(project.cwd, "no-repo-mcp-local");
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: local-deny-all
enforcement: block
executables:
  deny_all: true
`,
    );

    await getRunInstall()({
      cwd: project.cwd,
      noRepoPolicy: true,
      remotes: [],
      listGitRemotes: () => [],
    });
    expect(hasLockFile(project.cwd)).toBe(true);
  });

  test("org executables deny_all still withholds MCP with noRepoPolicy", async () => {
    project = createTempProject();
    writeMcpGrantProject(project.cwd, "no-repo-mcp-org");
    writePolicy(
      project.cwd,
      "bapm-policy.yml",
      `name: local-deny-all
enforcement: block
executables:
  deny_all: true
`,
    );

    await expectRejectsMatching(
      () =>
        getRunInstall()({
          cwd: project.cwd,
          noRepoPolicy: true,
          ...remotePolicyArgs(ORG_DENY_ALL_EXECUTABLES),
        }),
      /MCP withheld|unapproved dependency executables|org|deny/i,
    );
  });

  test("noPolicy full escape also ignores org executables deny_all", async () => {
    project = createTempProject();
    writeMcpGrantProject(project.cwd, "no-repo-mcp-all");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    await getRunInstall()({
      cwd: project.cwd,
      noPolicy: true,
      ...remotePolicyArgs(ORG_DENY_ALL_EXECUTABLES),
    });
    expect(hasLockFile(project.cwd)).toBe(true);
  });
});
