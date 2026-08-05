/**
 * p7g-outdated-sha-tag-drift acceptance helpers (core).
 * Injectable annotated tag evidence for revision-pin path (apply extends FakeTag).
 */
import {
  createFakePorts,
  createTempProject,
  exitCodeOf,
  fakeCommit,
  getRunOutdated,
  rowsOf,
  statusOf,
  textOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "../../lifecycle/helpers.ts";

export {
  createTempProject,
  exitCodeOf,
  fakeCommit,
  getRunOutdated,
  rowsOf,
  statusOf,
  textOf,
  writeLock,
  writeManifest,
  type TempProject,
};

/** Tag record with optional annotated peel evidence (APM fence). */
export type AnnotatedFakeTag = {
  tag: string;
  commit: string;
  /** Positive annotated evidence; missing/false = lightweight / unknown. */
  annotated?: boolean;
};

export type RevisionPinPorts = {
  gitRemote: { resolveRef: (repoUrl: string, ref: string) => Promise<string> };
  tagLister: {
    listTags: (repoUrl: string) => Promise<AnnotatedFakeTag[]>;
  };
  lsRemoteCalls: string[];
  tagListCalls: string[];
};

/**
 * Fake ports that preserve `annotated` on tag records for revision-pin stubs.
 * Base createFakePorts already returns tagsByRepo entries as-is.
 */
export function createRevisionPinPorts(options?: {
  tagsByRepo?: Record<string, AnnotatedFakeTag[]>;
  commitsByRef?: Record<string, string>;
}): RevisionPinPorts {
  const base = createFakePorts({
    tagsByRepo: options?.tagsByRepo as
      | Record<string, Array<{ tag: string; commit: string }>>
      | undefined,
    commitsByRef: options?.commitsByRef,
  });
  return {
    gitRemote: base.gitRemote,
    tagLister: base.tagLister as RevisionPinPorts["tagLister"],
    lsRemoteCalls: base.lsRemoteCalls,
    tagListCalls: base.tagListCalls,
  };
}

export function shortSha(sha: string, n = 8): string {
  return sha.slice(0, n).toLowerCase();
}

/** Full-SHA lock pin without constraint (revision-pin gate). */
export function writeFullShaPinFixture(
  cwd: string,
  options: {
    name: string;
    repo: string;
    pinSha: string;
    manifestRef?: string;
  },
): void {
  const { name, repo, pinSha } = options;
  const manifestRef = options.manifestRef ?? pinSha;
  writeManifest(
    cwd,
    "bapm.yml",
    `name: p7g-${name}
version: 0.0.1
dependencies:
  apm:
    - git: https://github.com/${repo}.git
      ref: ${manifestRef}
`,
  );
  writeLock(
    cwd,
    "bapm.lock.yaml",
    `lockfile_version: "1"
dependencies:
  - repo_url: github.com/${repo}
    name: ${name}
    resolved_commit: "${pinSha}"
    resolved_ref: "${pinSha}"
`,
  );
}

export function findRowByName(
  rows: Record<string, unknown>[],
  name: string,
): Record<string, unknown> | undefined {
  return rows.find((r) => String(r.name ?? "") === name);
}
