/**
 * `bapm auth` — read-only credential resolution, --check probe, --export line.
 */
import { describe, expect, test } from "vite-plus/test";
import { createAuth, type AuthProbeRequest } from "../../src/modules/Auth/index.ts";
import { runCli } from "../../src/index.ts";
import { withCapturedIo } from "../mcp/helpers.ts";

function authWith(
  env: NodeJS.ProcessEnv,
  probe?: (request: AuthProbeRequest) => Promise<{ status: number }>,
) {
  return createAuth({
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
    env,
    ...(probe ? { probe } : {}),
  });
}

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const keys = [
    "GITHUB_TOKEN",
    "GH_TOKEN",
    "GITHUB_APM_PAT",
    "GITLAB_TOKEN",
    "GITLAB_APM_PAT",
    "ADO_APM_PAT",
  ];
  const saved: Record<string, string | undefined> = {};
  for (const key of keys) saved[key] = process.env[key];
  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe("bapm auth resolution", () => {
  test("found token reports the env source and never prints the secret", async () => {
    const auth = authWith({ GITHUB_TOKEN: "ghp_secret" });
    const { result, stdout, stderr } = await withCapturedIo(() =>
      auth.run({ args: ["github.com"] }),
    );

    expect(result.exitCode).toBe(0);
    const text = [...stdout, ...stderr].join("\n");
    expect(text).toMatch(/using credential from GITHUB_TOKEN/);
    expect(text).not.toContain("ghp_secret");
  });

  test("missing token exits non-zero and names the env variable to set", async () => {
    const auth = authWith({});
    const { result, stdout, stderr } = await withCapturedIo(() =>
      auth.run({ args: ["github.com"] }),
    );

    expect(result.exitCode).toBe(1);
    const text = [...stdout, ...stderr].join("\n");
    expect(text).toMatch(/no credential found/i);
    expect(text).toMatch(/GITHUB_APM_PAT/);
  });

  test("--export prints exactly one export line on stdout", async () => {
    const auth = authWith({ GITHUB_TOKEN: "ghp_secret" });
    const { result, stdout, stderr } = await withCapturedIo(() =>
      auth.run({ args: ["github.com", "--export"] }),
    );

    expect(result.exitCode).toBe(0);
    expect(stdout).toEqual(["export GITHUB_APM_PAT='ghp_secret'"]);
    expect(stderr.join("\n")).toMatch(/GITHUB_TOKEN/);
    expect(stderr.join("\n")).not.toContain("ghp_secret");
  });

  test("--export shell-quotes an embedded single quote", async () => {
    const auth = authWith({ GITHUB_TOKEN: "a'b" });
    const { stdout } = await withCapturedIo(() => auth.run({ args: ["github.com", "--export"] }));
    expect(stdout).toEqual(["export GITHUB_APM_PAT='a'\\''b'"]);
  });

  test("verbose diagnostics never include the token", async () => {
    const auth = authWith({ GITHUB_TOKEN: "ghp_secret" }, async () => ({ status: 200 }));
    const { result, stdout, stderr } = await withCapturedIo(() =>
      auth.run({ args: ["github.com", "--check", "-v"] }),
    );

    expect(result.exitCode).toBe(0);
    const text = [...stdout, ...stderr].join("\n");
    expect(text).toMatch(/host-class: github/);
    expect(text).toMatch(/credential-class: github\.com/);
    expect(text).toMatch(/source: GITHUB_TOKEN/);
    expect(text).not.toContain("ghp_secret");
  });

  test("unsupported generic host fails closed with host hints", async () => {
    const auth = authWith({ GITHUB_TOKEN: "ghp_secret" });
    const { result, stdout, stderr } = await withCapturedIo(() =>
      auth.run({ args: ["example.com"] }),
    );

    expect(result.exitCode).toBe(1);
    const text = [...stdout, ...stderr].join("\n");
    expect(text).toMatch(/No token flow for 'example\.com'/);
    expect(text).toMatch(/GITHUB_HOST=example\.com/);
    expect(text).toMatch(/GITLAB_HOST=example\.com/);
  });

  test("aliases resolve to the canonical host and export variable", async () => {
    const gitlab = authWith({ GITLAB_APM_PAT: "glpat_secret" });
    const gitlabResult = await withCapturedIo(() => gitlab.run({ args: ["gitlab", "--export"] }));
    expect(gitlabResult.stdout).toEqual(["export GITLAB_APM_PAT='glpat_secret'"]);

    const ado = authWith({ ADO_APM_PAT: "ado_secret" });
    const adoResult = await withCapturedIo(() => ado.run({ args: ["ado", "--export"] }));
    expect(adoResult.stdout).toEqual(["export ADO_APM_PAT='ado_secret'"]);
  });

  test("ghes alias requires GITHUB_HOST", async () => {
    const missing = authWith({ GITHUB_TOKEN: "ghp_secret" });
    const missingResult = await withCapturedIo(() => missing.run({ args: ["ghes"] }));
    expect(missingResult.result.exitCode).toBe(1);
    expect([...missingResult.stdout, ...missingResult.stderr].join("\n")).toMatch(/GITHUB_HOST/);

    const configured = authWith({ GITHUB_HOST: "ghe.corp.example", GITHUB_TOKEN: "ghp_secret" });
    const ok = await withCapturedIo(() => configured.run({ args: ["ghes", "--export"] }));
    expect(ok.result.exitCode).toBe(0);
    expect(ok.stdout).toEqual(["export GITHUB_APM_PAT='ghp_secret'"]);
  });
});

describe("bapm auth --check", () => {
  test("injected probe receives the host-native endpoint and auth header", async () => {
    const calls: AuthProbeRequest[] = [];
    const auth = authWith({ GITHUB_TOKEN: "ghp_secret" }, async (request) => {
      calls.push(request);
      return { status: 200 };
    });

    const { result, stdout, stderr } = await withCapturedIo(() =>
      auth.run({ args: ["github.com", "--check", "--export"] }),
    );

    expect(result.exitCode).toBe(0);
    expect(stdout).toEqual(["export GITHUB_APM_PAT='ghp_secret'"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      host: "github.com",
      providerClass: "github",
      url: "https://api.github.com/user",
      headers: { Authorization: "Bearer ghp_secret" },
    });
    expect([...stdout, ...stderr].join("\n")).toMatch(/works/);
  });

  test("rejected token exits non-zero and suppresses --export stdout", async () => {
    const auth = authWith({ GITHUB_TOKEN: "ghp_bad" }, async () => ({ status: 401 }));
    const { result, stdout, stderr } = await withCapturedIo(() =>
      auth.run({ args: ["github.com", "--check", "--export"] }),
    );

    expect(result.exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr.join("\n")).toMatch(/rejected \(HTTP 401\)/);
    expect(stderr.join("\n")).not.toContain("ghp_bad");
  });

  test("unreachable / 5xx keeps the credential and exits 0", async () => {
    const auth = authWith({ GITHUB_TOKEN: "ghp_secret" }, async () => ({ status: 503 }));
    const { result, stdout, stderr } = await withCapturedIo(() =>
      auth.run({ args: ["github.com", "--check", "--export"] }),
    );

    expect(result.exitCode).toBe(0);
    expect(stdout).toEqual(["export GITHUB_APM_PAT='ghp_secret'"]);
    expect(stderr.join("\n")).toMatch(/could not validate/);
  });

  test("GitHub App installation token 403 is indeterminate, not rejected", async () => {
    const auth = authWith({ GITHUB_TOKEN: "ghs_installation" }, async () => ({ status: 403 }));
    const { result, stdout, stderr } = await withCapturedIo(() =>
      auth.run({ args: ["github.com", "--check"] }),
    );

    expect(result.exitCode).toBe(0);
    const text = [...stdout, ...stderr].join("\n");
    expect(text).toMatch(/installation token has no user context/);
    expect(text).not.toContain("ghs_installation");
  });

  test("GitLab uses PRIVATE-TOKEN against /api/v4/user", async () => {
    const calls: AuthProbeRequest[] = [];
    const auth = authWith({ GITLAB_TOKEN: "glpat_secret" }, async (request) => {
      calls.push(request);
      return { status: 200 };
    });

    const { result } = await withCapturedIo(() => auth.run({ args: ["gitlab.com", "--check"] }));

    expect(result.exitCode).toBe(0);
    expect(calls[0]).toMatchObject({
      url: "https://gitlab.com/api/v4/user",
      headers: { "PRIVATE-TOKEN": "glpat_secret" },
    });
  });
});

describe("bapm auth CLI wiring", () => {
  test("registry exposes bapm auth --export", async () => {
    await withEnv({ GITHUB_TOKEN: "ghp_cli" }, async () => {
      const { result, stdout, stderr } = await withCapturedIo(() =>
        runCli(["auth", "github.com", "--export"]),
      );
      expect(result).toBe(0);
      expect(stdout).toEqual(["export GITHUB_APM_PAT='ghp_cli'"]);
      expect(stderr.join("\n")).not.toMatch(/unknown command/i);
    });
  });

  test("help lists auth and documents --check / --export", async () => {
    const top = await withCapturedIo(() => runCli(["help"]));
    expect([...top.stdout, ...top.stderr].join("\n")).toMatch(/\bauth\b/);

    const topic = await withCapturedIo(() => runCli(["auth", "--help"]));
    const text = [...topic.stdout, ...topic.stderr].join("\n");
    expect(topic.result).toBe(0);
    expect(text).toMatch(/--check/);
    expect(text).toMatch(/--export/);
    expect(text).toMatch(/GITHUB_APM_PAT/);
  });

  test("unknown flag fails closed", async () => {
    const { result, stdout, stderr } = await withCapturedIo(() =>
      runCli(["auth", "github.com", "--not-a-real-flag"]),
    );
    expect(result).toBe(1);
    expect([...stdout, ...stderr].join("\n")).toMatch(/not-a-real-flag|unknown/i);
  });
});
