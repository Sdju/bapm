/**
 * p7b-outdated-machine-output acceptance helpers (core).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFakePorts,
  createTempProject,
  exitCodeOf,
  fakeCommit,
  getRunOutdated,
  rowsOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "../../lifecycle/helpers.ts";

export {
  createFakePorts,
  createTempProject,
  exitCodeOf,
  fakeCommit,
  getRunOutdated,
  rowsOf,
  writeLock,
  writeManifest,
  type TempProject,
};

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../../..");

export function readOutdatedTypesSource(): string {
  return readFileSync(join(coreRoot, "src/modules/Outdated/types.ts"), "utf8");
}

export function readOutdatedRunSource(): string {
  return readFileSync(join(coreRoot, "src/modules/Outdated/runOutdated.ts"), "utf8");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type ConcurrencyProbe = {
  maxInFlight: number;
  overlapEvents: number;
  gitRemote: { resolveRef: (repoUrl: string, ref: string) => Promise<string> };
  tagLister: { listTags: (repoUrl: string) => Promise<Array<{ tag: string; commit: string }>> };
};

/**
 * Wrap fake ports with per-call delay + in-flight tracking for remote checks.
 * delayByRepoKey: substring of repo URL → delay ms (defaultDelay otherwise).
 */
export function createProbingPorts(options: {
  tagsByRepo?: Record<string, Array<{ tag: string; commit: string }>>;
  commitsByRef?: Record<string, string>;
  defaultDelayMs?: number;
  delayByRepoKey?: Record<string, number>;
}): ConcurrencyProbe {
  const base = createFakePorts({
    tagsByRepo: options.tagsByRepo,
    commitsByRef: options.commitsByRef,
  });
  const defaultDelayMs = options.defaultDelayMs ?? 40;
  const delayByRepoKey = options.delayByRepoKey ?? {};

  let inFlight = 0;
  let maxInFlight = 0;
  let overlapEvents = 0;

  const delayFor = (repoUrl: string): number => {
    for (const [key, ms] of Object.entries(delayByRepoKey)) {
      if (repoUrl.includes(key)) return ms;
    }
    return defaultDelayMs;
  };

  const track = async <T>(repoUrl: string, work: () => Promise<T>): Promise<T> => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    if (inFlight > 1) overlapEvents += 1;
    try {
      await sleep(delayFor(repoUrl));
      return await work();
    } finally {
      inFlight -= 1;
    }
  };

  return {
    get maxInFlight() {
      return maxInFlight;
    },
    get overlapEvents() {
      return overlapEvents;
    },
    gitRemote: {
      async resolveRef(repoUrl: string, ref: string) {
        return track(repoUrl, () => base.gitRemote.resolveRef(repoUrl, ref));
      },
    },
    tagLister: {
      async listTags(repoUrl: string) {
        return track(repoUrl, () => base.tagLister.listTags(repoUrl));
      },
    },
  };
}

/** Three remote tip-check deps in lock order alpha → beta → gamma. */
export function writeThreeRemoteFixture(cwd: string): {
  commits: { alpha: string; beta: string; gamma: string };
} {
  const alpha = fakeCommit("p7b-alpha");
  const beta = fakeCommit("p7b-beta");
  const gamma = fakeCommit("p7b-gamma");

  writeManifest(
    cwd,
    "bapm.yml",
    `name: p7b-parallel
version: 0.0.1
dependencies:
  apm:
    - git: https://github.com/example/alpha.git
      ref: main
    - git: https://github.com/example/beta.git
      ref: main
    - git: https://github.com/example/gamma.git
      ref: main
`,
  );
  writeLock(
    cwd,
    "bapm.lock.yaml",
    `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/alpha
    name: alpha
    resolved_commit: "${alpha}"
    resolved_ref: main
  - repo_url: github.com/example/beta
    name: beta
    resolved_commit: "${beta}"
    resolved_ref: main
  - repo_url: github.com/example/gamma
    name: gamma
    resolved_commit: "${gamma}"
    resolved_ref: main
`,
  );

  return { commits: { alpha, beta, gamma } };
}

/** Five remote tip-check deps (saturates default parallelChecks=4). */
export function writeFiveRemoteFixture(cwd: string): void {
  const names = ["d1", "d2", "d3", "d4", "d5"] as const;
  const pins = names.map((name) => ({ name, commit: fakeCommit(`p7b-${name}`) }));

  writeManifest(
    cwd,
    "bapm.yml",
    `name: p7b-default4
version: 0.0.1
dependencies:
  apm:
${pins.map((p) => `    - git: https://github.com/example/${p.name}.git\n      ref: main`).join("\n")}
`,
  );
  writeLock(
    cwd,
    "bapm.lock.yaml",
    `lockfile_version: "1"
dependencies:
${pins
  .map(
    (p) => `  - repo_url: github.com/example/${p.name}
    name: ${p.name}
    resolved_commit: "${p.commit}"
    resolved_ref: main`,
  )
  .join("\n")}
`,
  );
}
