/**
 * Core compile watch loop: initial run, debounced recompile, error tolerance,
 * serial runs, clean abort, and target resolution.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createNodeCompileWatchFactory,
  resolveCompileWatchTargets,
  watchCompile,
  type CompileWatchFactory,
  type CompileWatchHandle,
} from "../../src/index.ts";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-watch-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for watch event");
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

describe("compile watch targets", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("resolves manifest, .apm, modules and local dependency directories", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: watch-targets",
        "version: 0.0.1",
        "dependencies:",
        "  apm:",
        "    - local: vendor/local",
        "    - path: vendor/other",
        "",
      ].join("\n"),
    );

    const paths = resolveCompileWatchTargets(project.cwd).map((target) => target.path);

    expect(paths).toContain(project.cwd);
    expect(paths).toContain(join(project.cwd, ".apm"));
    expect(paths).toContain(join(project.cwd, "apm_modules"));
    expect(paths).toContain(join(project.cwd, "vendor", "local"));
    expect(paths).toContain(join(project.cwd, "vendor", "other"));
  });

  test("default fs watcher reports a new instruction file", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".apm", "instructions"), { recursive: true });
    const changed: string[] = [];
    const handle = createNodeCompileWatchFactory({
      cwd: project.cwd,
      targets: [{ path: join(project.cwd, ".apm"), recursive: true }],
      onChange: (paths) => changed.push(...paths),
    });

    try {
      writeText(join(project.cwd, ".apm", "instructions", "fresh.md"), "# Fresh\n");
      await waitFor(() => changed.length > 0);
      expect(changed.join("\n")).toMatch(/fresh\.md/);
    } finally {
      handle.close();
    }
  });
});

describe("watchCompile loop", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("once mode runs the initial compile and opens no watcher", async () => {
    project = createTempProject();
    let calls = 0;
    let watcherCreated = false;

    const result = await watchCompile({
      cwd: project.cwd,
      once: true,
      compile: async () => {
        calls += 1;
      },
      watchFactory: () => {
        watcherCreated = true;
        return { close: () => undefined };
      },
      onStatus: () => undefined,
    });

    expect(calls).toBe(1);
    expect(watcherCreated).toBe(false);
    expect(result).toEqual({ runs: 1, errors: 0, stopped: "once" });
  });

  test("a change is debounced, recompiled, and signal closes the watcher", async () => {
    project = createTempProject();
    const controller = new AbortController();
    const statuses: string[] = [];
    let calls = 0;
    let change: ((paths: string[]) => void) | undefined;
    let closed = false;

    const running = watchCompile({
      cwd: project.cwd,
      debounceMs: 10,
      compile: async () => {
        calls += 1;
      },
      watchFactory: injectedFactory(
        (next) => {
          change = next;
        },
        () => {
          closed = true;
        },
      ),
      resolveTargets: () => [{ path: project!.cwd }],
      signal: controller.signal,
      onStatus: (message) => statuses.push(message),
    });

    await waitFor(() => change !== undefined);
    expect(calls).toBe(1);

    change!(["one"]);
    change!(["two"]);
    change!(["three"]);
    await waitFor(() => calls === 2);

    controller.abort();
    const result = await running;

    expect(result.stopped).toBe("signal");
    expect(result.runs).toBe(2);
    expect(result.errors).toBe(0);
    expect(calls).toBe(2);
    expect(closed).toBe(true);
    expect(statuses.join("\n")).toMatch(/change detected/i);
    expect(statuses.join("\n")).toMatch(/recompiled/i);
    expect(statuses.join("\n")).toMatch(/stopped/i);
  });

  test("compile errors are reported and watch continues", async () => {
    project = createTempProject();
    const controller = new AbortController();
    const errors: unknown[] = [];
    const statuses: string[] = [];
    let calls = 0;
    let change: ((paths: string[]) => void) | undefined;

    const running = watchCompile({
      cwd: project.cwd,
      debounceMs: 5,
      compile: async () => {
        calls += 1;
        if (calls === 1) throw new Error("transient boom");
      },
      watchFactory: injectedFactory((next) => {
        change = next;
      }),
      resolveTargets: () => [{ path: project!.cwd }],
      signal: controller.signal,
      onStatus: (message) => statuses.push(message),
      onError: (error) => errors.push(error),
    });

    await waitFor(() => change !== undefined);
    expect(calls).toBe(1);
    expect(errors).toHaveLength(1);
    expect(statuses.join("\n")).toMatch(/compile failed; still watching/i);

    change!(["retry"]);
    await waitFor(() => calls === 2);
    controller.abort();
    const result = await running;

    expect(result).toEqual({ runs: 2, errors: 1, stopped: "signal" });
    expect(calls).toBe(2);
  });

  test("compile's own outputs do not retrigger the watcher", async () => {
    project = createTempProject();
    const controller = new AbortController();
    let calls = 0;
    let change: ((paths: string[]) => void) | undefined;
    const output = join(project.cwd, "skills", "AGENTS.md");

    const running = watchCompile({
      cwd: project.cwd,
      debounceMs: 5,
      compile: async () => {
        calls += 1;
        return { outputs: [{ targetId: "cursor", path: output, wrote: true }] };
      },
      watchFactory: injectedFactory((next) => {
        change = next;
      }),
      resolveTargets: () => [{ path: join(project!.cwd, "skills"), recursive: true }],
      signal: controller.signal,
      onStatus: () => undefined,
    });

    await waitFor(() => change !== undefined);
    change!([output]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toBe(1);

    change!([join(project.cwd, "skills", "real-input.md")]);
    await waitFor(() => calls === 2);
    controller.abort();
    await running;
    expect(calls).toBe(2);
  });

  test("events during a run queue one follow-up instead of overlapping", async () => {
    project = createTempProject();
    const controller = new AbortController();
    let calls = 0;
    let active = 0;
    let maxActive = 0;
    let change: ((paths: string[]) => void) | undefined;
    let finishSlow: (() => void) | undefined;

    const running = watchCompile({
      cwd: project.cwd,
      debounceMs: 1,
      compile: async () => {
        calls += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (calls === 2) {
          await new Promise<void>((resolve) => {
            finishSlow = resolve;
          });
        }
        active -= 1;
      },
      watchFactory: injectedFactory((next) => {
        change = next;
      }),
      resolveTargets: () => [{ path: project!.cwd }],
      signal: controller.signal,
      onStatus: () => undefined,
    });

    await waitFor(() => change !== undefined);
    change!(["first"]);
    await waitFor(() => calls === 2);
    change!(["second"]);
    change!(["third"]);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toBe(2);
    expect(maxActive).toBe(1);

    finishSlow!();
    await waitFor(() => calls === 3);
    controller.abort();
    const result = await running;

    expect(result.runs).toBe(3);
    expect(maxActive).toBe(1);
  });
});
