/**
 * Core outdated parallelChecks: 0 serial, bound real concurrency, lock order (MUST).
 */
import { asText } from "../asText.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createProbingPorts,
  createTempProject,
  exitCodeOf,
  getRunOutdated,
  rowsOf,
  writeFiveRemoteFixture,
  writeThreeRemoteFixture,
  type TempProject,
} from "./helpers.ts";

describe("core outdated parallelChecks", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("parallelChecks 0 runs remote checks serially (no overlap)", async () => {
    project = createTempProject();
    writeThreeRemoteFixture(project.cwd);
    const probe = createProbingPorts({
      commitsByRef: { main: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" },
      defaultDelayMs: 35,
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      parallelChecks: 0,
      gitRemote: probe.gitRemote,
      tagLister: probe.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    expect(probe.maxInFlight).toBe(1);
    expect(probe.overlapEvents).toBe(0);
  });

  test("parallelChecks 2 bounds in-flight and allows overlap; rows keep lock order", async () => {
    project = createTempProject();
    writeThreeRemoteFixture(project.cwd);
    // Finish out of submission order: alpha slow, beta fast, gamma medium.
    const tip = "cafebabecafebabecafebabecafebabecafebabe";
    const probe = createProbingPorts({
      commitsByRef: { main: tip },
      defaultDelayMs: 40,
      delayByRepoKey: {
        alpha: 90,
        beta: 15,
        gamma: 45,
      },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      parallelChecks: 2,
      gitRemote: probe.gitRemote,
      tagLister: probe.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    expect(probe.maxInFlight).toBeLessThanOrEqual(2);
    expect(probe.maxInFlight).toBeGreaterThanOrEqual(2);
    expect(probe.overlapEvents).toBeGreaterThan(0);

    const names = rowsOf(result).map((r) => asText(r.name ?? ""));
    expect(names).toEqual(["alpha", "beta", "gamma"]);
  });

  test("omitted parallelChecks defaults to concurrency up to 4 (not forced serial)", async () => {
    project = createTempProject();
    writeFiveRemoteFixture(project.cwd);
    const tip = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const probe = createProbingPorts({
      commitsByRef: { main: tip },
      defaultDelayMs: 50,
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      // intentionally omit parallelChecks
      gitRemote: probe.gitRemote,
      tagLister: probe.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    expect(probe.maxInFlight).toBeGreaterThan(1);
    expect(probe.maxInFlight).toBeLessThanOrEqual(4);
    expect(probe.overlapEvents).toBeGreaterThan(0);

    const names = rowsOf(result).map((r) => asText(r.name ?? ""));
    expect(names).toEqual(["d1", "d2", "d3", "d4", "d5"]);
  });
});
