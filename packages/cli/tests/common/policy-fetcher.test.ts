/**
 * CLI policy fetcher: https-only, curl args, injected executor (no network).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  createPolicyFetcher,
  isPolicyFullEscape,
  resolvePolicyPorts,
} from "../../src/common/policyFetcher.ts";

describe("createPolicyFetcher", () => {
  test("returns document text on curl success", () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const fetcher = createPolicyFetcher({
      run: (command, args) => {
        calls.push({ command, args });
        return { status: 0, stdout: "name: org\nenforcement: block\n\n200" };
      },
    });

    const result = fetcher("https://github.com/acme/.github/apm-policy.yml");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.text).toContain("name: org");
    expect(result.body).toBe(result.text);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.command).toBe("curl");
    expect(calls[0]!.args).toContain("-sSL");
    expect(calls[0]!.args).toContain("-w");
    expect(calls[0]!.args).toContain("--max-time");
    expect(calls[0]!.args).toEqual(
      expect.arrayContaining([
        "--proto",
        "=https",
        "https://github.com/acme/.github/apm-policy.yml",
      ]),
    );
  });

  test("rejects non-https URLs without invoking the executor", () => {
    let called = false;
    const fetcher = createPolicyFetcher({
      run: () => {
        called = true;
        return { status: 0, stdout: "name: org\nenforcement: block\n\n200" };
      },
    });

    for (const url of [
      "http://github.com/acme/.github/apm-policy.yml",
      "file:///etc/passwd",
      "git@github.com:acme/.github.git",
      "not a url",
    ]) {
      const result = fetcher(url);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(0);
    }
    expect(called).toBe(false);
  });

  test("maps curl non-zero exit / spawn error / timeout to ok:false status:0", () => {
    expect(createPolicyFetcher({ run: () => ({ status: 22 }) })("https://github.com/a/b")).toEqual({
      ok: false,
      status: 22,
      url: "https://github.com/a/b",
    });
    expect(
      createPolicyFetcher({ run: () => ({ status: 0, stdout: "\n404" }) })(
        "https://github.com/a/b",
      ),
    ).toEqual({ ok: false, status: 404, url: "https://github.com/a/b" });
    expect(
      createPolicyFetcher({ run: () => ({ status: 0, stdout: "\n503" }) })(
        "https://github.com/a/b",
      ),
    ).toEqual({ ok: false, status: 503, url: "https://github.com/a/b" });
    expect(
      createPolicyFetcher({
        run: () => ({ status: null, error: new Error("spawn curl ENOENT") }),
      })("https://github.com/a/b"),
    ).toEqual({ ok: false, status: 0, url: "https://github.com/a/b" });
    expect(
      createPolicyFetcher({
        run: () => {
          throw new Error("timeout");
        },
      })("https://github.com/a/b"),
    ).toEqual({ ok: false, status: 0, url: "https://github.com/a/b" });
  });

  test("default executor returns ok:false when curl is unavailable", () => {
    const fetcher = createPolicyFetcher({ binary: "bapm-test-missing-curl-binary" });
    const result = fetcher("https://github.com/a/b");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
  });
});

describe("resolvePolicyPorts", () => {
  test("injects fetchPolicyUrl and httpGet for normal runs", () => {
    const injected = () => ({ ok: true, status: 200, text: "name: x\nenforcement: warn\n" });
    const ports = resolvePolicyPorts({ policyPorts: { fetchPolicyUrl: injected } });
    expect(ports.fetchPolicyUrl).toBe(injected);
    expect(ports.httpGet).toBe(injected);
  });

  test("--no-policy (repo-only) keeps the fetcher", () => {
    const injected = () => ({ ok: false, status: 404 });
    const ports = resolvePolicyPorts({
      noPolicy: false,
      policyPorts: { fetchPolicyUrl: injected },
    });
    expect(ports.fetchPolicyUrl).toBe(injected);
  });

  test("full escape returns no ports", () => {
    const injected = () => ({ ok: true, status: 200, text: "name: x\nenforcement: warn\n" });
    expect(
      resolvePolicyPorts({ noPolicy: true, policyPorts: { fetchPolicyUrl: injected } }),
    ).toEqual({});
    expect(
      resolvePolicyPorts({
        env: { BAPM_POLICY_DISABLE: "1" },
        policyPorts: { fetchPolicyUrl: injected },
      }),
    ).toEqual({});
  });

  test("isPolicyFullEscape honors env aliases", () => {
    const prevBapm = process.env.BAPM_POLICY_DISABLE;
    const prevApm = process.env.APM_POLICY_DISABLE;
    delete process.env.BAPM_POLICY_DISABLE;
    delete process.env.APM_POLICY_DISABLE;
    try {
      expect(isPolicyFullEscape({})).toBe(false);
      expect(isPolicyFullEscape({ env: { APM_POLICY_DISABLE: "1" } })).toBe(true);
    } finally {
      if (prevBapm === undefined) delete process.env.BAPM_POLICY_DISABLE;
      else process.env.BAPM_POLICY_DISABLE = prevBapm;
      if (prevApm === undefined) delete process.env.APM_POLICY_DISABLE;
      else process.env.APM_POLICY_DISABLE = prevApm;
    }
  });
});
