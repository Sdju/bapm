/**
 * Issue #31 — install failures must surface their `cause` chain with -v/--verbose.
 * Covers the reusable formatter and the install catch-all call site.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatErrorCauseChain,
  formatErrorMessage,
} from "../../src/common/formatErrorCauseChain.ts";
import {
  createTempProject,
  linkCursorIntegration,
  runCli,
  withCapturedIo,
  withCwd,
  type TempProject,
} from "./helpers.ts";

describe("formatErrorCauseChain", () => {
  test("non-verbose renders only the top-level message", () => {
    const error = new Error("Failed to download https://example.test/repo.git", {
      cause: new Error("Local path not found: skills/frontend-design"),
    });

    expect(formatErrorCauseChain(error)).toBe("Failed to download https://example.test/repo.git");
    expect(formatErrorCauseChain(error, { verbose: false })).toBe(
      "Failed to download https://example.test/repo.git",
    );
  });

  test("verbose renders nested Error causes as indented cause lines", () => {
    const leaf = new Error("Local path not found: skills/frontend-design");
    const middle = new Error("Failed to materialize local skill", { cause: leaf });
    const top = new Error("Failed to download https://example.test/repo.git", {
      cause: middle,
    });

    expect(formatErrorCauseChain(top, { verbose: true })).toBe(
      [
        "Failed to download https://example.test/repo.git",
        "  cause: Failed to materialize local skill",
        "  cause: Local path not found: skills/frontend-design",
      ].join("\n"),
    );
  });

  test("handles non-Error causes (string, object with message, primitive)", () => {
    const error = new Error("outer", {
      cause: { message: "middle", cause: 404 },
    });

    expect(formatErrorCauseChain(error, { verbose: true })).toBe(
      ["outer", "  cause: middle", "  cause: 404"].join("\n"),
    );

    expect(
      formatErrorCauseChain(new Error("outer", { cause: "plain string cause" }), {
        verbose: true,
      }),
    ).toBe(["outer", "  cause: plain string cause"].join("\n"));
  });

  test("stops at a cyclic cause chain", () => {
    const first = new Error("first") as Error & { cause?: unknown };
    const second = new Error("second") as Error & { cause?: unknown };
    first.cause = second;
    second.cause = first;

    const rendered = formatErrorCauseChain(first, { verbose: true });
    expect(rendered).toBe(["first", "  cause: second", "  cause: [circular cause]"].join("\n"));
  });

  test("caps the chain at maxDepth", () => {
    let error: Error = new Error("level-4");
    for (let i = 3; i >= 0; i--) {
      error = new Error(`level-${i}`, { cause: error });
    }

    expect(formatErrorCauseChain(error, { verbose: true, maxDepth: 2 })).toBe(
      [
        "level-0",
        "  cause: level-1",
        "  cause: level-2",
        "  cause: [cause chain truncated after 2 level(s)]",
      ].join("\n"),
    );
  });

  test("uses a caller-supplied top-level message", () => {
    const error = new Error("raw", { cause: new Error("inner") });
    expect(formatErrorCauseChain(error, { verbose: true, message: "enriched raw" })).toBe(
      ["enriched raw", "  cause: inner"].join("\n"),
    );
  });

  test("formatErrorMessage tolerates non-Errors", () => {
    expect(formatErrorMessage("plain")).toBe("plain");
    expect(formatErrorMessage({ message: "from object" })).toBe("from object");
    expect(formatErrorMessage(undefined)).toBe("undefined");
    expect(formatErrorMessage(new Error("from error"))).toBe("from error");
  });
});

describe("install -v cause rendering", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  function writeProjectWithBrokenLocalDep(cwd: string, name: string): void {
    mkdirSync(join(cwd, "leaf"), { recursive: true });
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const spec = linkCursorIntegration(cwd);
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: ${name}\nversion: 0.0.1\ntargets:\n  cursor: "${spec}"\ndependencies:\n  apm:\n    - path: ./leaf\n`,
      "utf8",
    );
    // Invalid YAML makes the transitive local manifest load fail with a cause chain.
    writeFileSync(join(cwd, "leaf", "bapm.yml"), "name: leaf\nversion: [unterminated\n", "utf8");
  }

  async function runInstall(args: string[]): Promise<{
    result: number;
    stderr: string;
  }> {
    project = createTempProject("bapm-cli-cause-");
    writeProjectWithBrokenLocalDep(project.cwd, "cli-cause-chain");
    const { result, stderr } = await withCwd(project.cwd, () =>
      withCapturedIo(() => runCli(["install", "--target", "cursor", ...args])),
    );
    return { result, stderr: stderr.join("\n") };
  }

  test("--verbose prints cause lines for install failures", async () => {
    const { result, stderr } = await runInstall(["--verbose"]);

    expect(result).not.toBe(0);
    expect(stderr).toMatch(/^bapm: /m);
    expect(stderr).toMatch(/\n {2}cause: /);
    expect(stderr).toMatch(/cause: .*(Manifest|YAML|manifest)/i);
  });

  test("-v prints cause lines for install failures", async () => {
    const { result, stderr } = await runInstall(["-v"]);

    expect(result).not.toBe(0);
    expect(stderr).toMatch(/\n {2}cause: /);
  });

  test("without -v install output stays single-line (no cause)", async () => {
    const { result, stderr } = await runInstall([]);

    expect(result).not.toBe(0);
    expect(stderr).not.toMatch(/cause:/);
    expect(stderr.trim().split("\n")).toHaveLength(1);
  });
});
