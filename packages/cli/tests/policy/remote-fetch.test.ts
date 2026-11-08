/**
 * CLI wiring for remote org policy discovery (github-owner-dotgithub).
 *
 * Injects the fetcher/remotes through the CLI option shape so tests never touch
 * the network; production resolves the same shape to a curl-backed fetcher.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createInstall } from "../../src/modules/Install/index.ts";
import { createLock } from "../../src/modules/Lock/index.ts";
import { createPolicy } from "../../src/modules/Policy/index.ts";
import {
  createTempProject,
  hasModules,
  parseJsonStdout,
  withCapturedIo,
  withCwd,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

const ORIGIN = "https://github.com/acme/app.git";
const ORG_POLICY_URL = "https://github.com/acme/.github/apm-policy.yml";
const ORG_PRIVATE_URL = "https://github.com/acme/.github-private/apm-policy.yml";
const REMOTE_DENY = `name: org-remote
enforcement: block
dependencies:
  deny:
    - leaf
`;

const install = createInstall({
  name: "bapm",
  manifestFile: "bapm.yml",
  lockFile: "bapm.lock.yaml",
});
const policy = createPolicy({
  name: "bapm",
  manifestFile: "bapm.yml",
  lockFile: "bapm.lock.yaml",
});

function injectedPorts(fetched: string[]) {
  return {
    remotes: [{ name: "origin", url: ORIGIN }],
    fetchPolicyUrl: (url: string) => {
      fetched.push(url);
      if (url === ORG_POLICY_URL) {
        return { ok: true, status: 200, text: REMOTE_DENY, url };
      }
      return { ok: false, status: 404, url };
    },
  };
}

async function runInstallInjected(
  cwd: string,
  argv: string[],
  policyPorts: ReturnType<typeof injectedPorts>,
): Promise<{ ok: boolean; combined: string }> {
  const captured = await withCwd(cwd, () =>
    withCapturedIo(() => install.run({ args: argv, cwd, policyPorts })),
  );
  return {
    ok: captured.result.ok,
    combined: [...captured.stdout, ...captured.stderr].join("\n"),
  };
}

async function runPolicyStatusInjected(
  cwd: string,
  argv: string[],
  policyPorts: ReturnType<typeof injectedPorts>,
): Promise<{ stdout: string[]; combined: string }> {
  const captured = await withCwd(cwd, () =>
    withCapturedIo(() => policy.run({ args: argv, cwd, policyPorts })),
  );
  return {
    stdout: captured.stdout,
    combined: [...captured.stdout, ...captured.stderr].join("\n"),
  };
}

describe("CLI remote org policy discovery", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("default production path uses the curl fetcher (fake curl on PATH, real git remote)", async () => {
    if (process.platform === "win32") return;
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-remote-default-fetcher");

    const gitInit = spawnSync("git", ["init", "-q"], { cwd: project.cwd, encoding: "utf8" });
    if (gitInit.error || gitInit.status !== 0) return; // git unavailable in this environment
    spawnSync("git", ["remote", "add", "origin", ORIGIN], { cwd: project.cwd, encoding: "utf8" });

    const binDir = join(project.cwd, "fake-bin");
    mkdirSync(binDir, { recursive: true });
    const fakeCurl = join(binDir, "curl");
    writeFileSync(fakeCurl, `#!/bin/sh\ncat <<'POLICY'\n${REMOTE_DENY}POLICY\n`, "utf8");
    chmodSync(fakeCurl, 0o755);

    const prevPath = process.env.PATH;
    process.env.PATH = `${binDir}:${prevPath ?? ""}`;
    try {
      const captured = await withCwd(project.cwd, () =>
        withCapturedIo(() => policy.run({ args: ["status", "--json"], cwd: project.cwd })),
      );
      const report = parseJsonStdout(captured.stdout);
      expect(report.provider).toBe("github-owner-dotgithub");
      expect(report.outcome).toBe("found");
      expect(report.enforcement).toBe("block");
    } finally {
      process.env.PATH = prevPath;
    }
  });

  test("policy status reports provider github-owner-dotgithub from fetched org policy", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-remote-status");
    const fetched: string[] = [];

    const { stdout, combined } = await runPolicyStatusInjected(
      project.cwd,
      ["status", "--json"],
      injectedPorts(fetched),
    );
    const report = parseJsonStdout(stdout);

    expect(combined).not.toMatch(/unknown command/i);
    expect(fetched).toEqual([ORG_PRIVATE_URL, ORG_POLICY_URL]);
    expect(report.outcome).toBe("found");
    expect(report.provider).toBe("github-owner-dotgithub");
    expect(report.enforcement).toBe("block");
    expect(String(report.source)).toContain(ORG_POLICY_URL);
  });

  test("install applies org deny before durable writes when no local policy exists", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-remote-install-deny");
    const fetched: string[] = [];

    const result = await runInstallInjected(
      project.cwd,
      ["--target", "cursor"],
      injectedPorts(fetched),
    );

    expect(fetched).toEqual([ORG_PRIVATE_URL, ORG_POLICY_URL]);
    expect(result.ok).toBe(false);
    expect(result.combined).toMatch(/policy|deny|block|leaf|violat/i);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("--no-policy still applies fetched org deny", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-remote-install-no-policy");
    const fetched: string[] = [];

    const result = await runInstallInjected(
      project.cwd,
      ["--target", "cursor", "--no-policy"],
      injectedPorts(fetched),
    );

    expect(fetched).toEqual([ORG_PRIVATE_URL, ORG_POLICY_URL]);
    expect(result.ok).toBe(false);
    expect(result.combined).toMatch(/policy|deny|block|leaf|violat/i);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("--no-policy-all skips org fetch and org deny (full escape)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-remote-install-escape");
    const fetched: string[] = [];

    const result = await runInstallInjected(
      project.cwd,
      ["--target", "cursor", "--no-policy-all"],
      injectedPorts(fetched),
    );

    expect(fetched).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("CLI lock forwards policy ports", () => {
  test("injected fetcher reaches resolveAndLock, and --no-policy-all drops it", async () => {
    let received: Record<string, unknown> | undefined;
    const lock = createLock({
      resolveAndLock: async (options) => {
        received = options as unknown as Record<string, unknown>;
        return { lockPath: "/tmp/bapm.lock.yaml" };
      },
    });
    const fetcher = (url: string) => ({ ok: true, status: 200, text: "name: x\n", url });

    const normal = await withCapturedIo(() =>
      lock.run({ args: [], policyPorts: { fetchPolicyUrl: fetcher } }),
    );
    expect(normal.result.ok).toBe(true);
    expect(received?.fetchPolicyUrl).toBe(fetcher);

    const escaped = await withCapturedIo(() =>
      lock.run({ args: ["--no-policy-all"], policyPorts: { fetchPolicyUrl: fetcher } }),
    );
    expect(escaped.result.ok).toBe(true);
    expect(received?.fetchPolicyUrl).toBeUndefined();
  });
});
