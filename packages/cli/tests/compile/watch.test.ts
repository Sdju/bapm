/**
 * CLI `compile --watch`: initial compile, injected recompile, transient errors,
 * validate incompatibility, and clean abort without hanging.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  runInProject,
  withCapturedIo,
  writeCompileProject,
  type TempProject,
} from "./helpers.ts";
import { runCompileCli } from "../../src/modules/Compile/services/runCompile.ts";
import type { CompileWatchFactory, CompileWatchHandle } from "@b-apm/core";

const deps = { name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml" };

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for compile watch");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function injectedFactory(
  onReady: (change: (paths: string[]) => void) => void,
  onClose?: () => void,
): CompileWatchFactory {
  return (options) => {
    onReady((paths) => options.onChange(paths));
    return { close: () => onClose?.() } satisfies CompileWatchHandle;
  };
}

describe("CLI compile --watch", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("--watch --validate fails closed", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "watch-validate");

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--watch",
      "--validate",
    ]);
    expect(result).toBe(1);
    expect(combined).toMatch(/--watch cannot be combined with --validate/i);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("watch recompiles after an injected change and exits 0 on abort", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "watch-recompile");
    const controller = new AbortController();
    let change: ((paths: string[]) => void) | undefined;
    let closed = false;

    const { result, stdout } = await withCapturedIo(async () => {
      const running = runCompileCli(deps, {
        args: ["--watch"],
        cwd: project!.cwd,
        watch: {
          watchFactory: injectedFactory(
            (next) => {
              change = next;
            },
            () => {
              closed = true;
            },
          ),
          debounceMs: 5,
          signal: controller.signal,
          resolveTargets: () => [{ path: project!.cwd }],
        },
      });

      const agents = join(project!.cwd, "AGENTS.md");
      await waitFor(() => existsSync(agents));
      expect(readFileSync(agents, "utf8")).toMatch(/concise/i);

      writeFileSync(
        join(project!.cwd, ".apm", "instructions", "style.md"),
        "# Style\nPrefer detailed answers.\n",
        "utf8",
      );
      await waitFor(() => change !== undefined);
      change!([join(project!.cwd, ".apm", "instructions", "style.md")]);

      await waitFor(() => readFileSync(agents, "utf8").includes("detailed"));
      controller.abort();
      return running;
    });

    expect(result.exitCode).toBe(0);
    expect(result.ok).toBe(true);
    expect(closed).toBe(true);
    expect(stdout.join("\n")).toMatch(/compile --watch: watching/i);
    expect(stdout.join("\n")).toMatch(/change detected/i);
    expect(stdout.join("\n")).toMatch(/recompiled/i);
  });

  test("initial compile errors keep the watcher alive until inputs are fixed", async () => {
    project = createTempProject();
    const controller = new AbortController();
    let change: ((paths: string[]) => void) | undefined;

    const { result, stdout, stderr } = await withCapturedIo(async () => {
      const running = runCompileCli(deps, {
        args: ["--watch"],
        cwd: project!.cwd,
        watch: {
          watchFactory: injectedFactory((next) => {
            change = next;
          }),
          debounceMs: 5,
          signal: controller.signal,
          resolveTargets: () => [{ path: project!.cwd }],
        },
      });

      await waitFor(() => change !== undefined);
      expect(existsSync(join(project!.cwd, "AGENTS.md"))).toBe(false);

      writeCompileProject(project!.cwd, "watch-recover");
      change!([join(project!.cwd, "bapm.yml")]);
      await waitFor(() => existsSync(join(project!.cwd, "AGENTS.md")));

      controller.abort();
      return running;
    });

    expect(result.exitCode).toBe(0);
    expect([...stdout, ...stderr].join("\n")).toMatch(/compile failed; still watching/i);
    expect(readFileSync(join(project!.cwd, "AGENTS.md"), "utf8")).toMatch(/concise/i);
  });

  test("watch once mode compiles without opening a watcher", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "watch-once");

    const { result, stdout } = await withCapturedIo(() =>
      runCompileCli(deps, {
        args: ["--watch"],
        cwd: project!.cwd,
        watch: {
          once: true,
          watchFactory: () => {
            throw new Error("watcher must not be created in once mode");
          },
        },
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(project!.cwd, "AGENTS.md"))).toBe(true);
    expect(stdout.join("\n")).toMatch(/Wrote AGENTS\.md/);
    expect(stdout.join("\n")).not.toMatch(/watching/i);
  });
});
