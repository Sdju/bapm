/**
 * Lifecycle / integrity test helpers for @b-apm/core domain APIs.
 */
import { asText } from "../asText.ts";
import * as core from "@b-apm/core";
import { loadLockfile } from "@b-apm/core";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFakePorts,
  createTempProject,
  depsOf,
  ensureDir,
  expectRejectsMatching,
  existingLockPath,
  fakeCommit,
  listFilesRecursive,
  lockOf,
  modulesDir,
  readLockBytes,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "../install/helpers.ts";

export {
  createFakePorts,
  createTempProject,
  depsOf,
  ensureDir,
  expectRejectsMatching,
  existingLockPath,
  fakeCommit,
  listFilesRecursive,
  lockOf,
  modulesDir,
  readLockBytes,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
};

export const lifecycleSuiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(lifecycleSuiteDir, "../..");

type AnyFn = (...args: never[]) => unknown;

function pickExport(names: string[]): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(
    `expected @b-apm/core to export one of [${names.join(", ")}] (lifecycle/integrity public API)`,
  );
}

/** Full/scoped update (rs-011/rs-012) + dry-run / yes / frozen refuse. */
export function getRunUpdate(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runUpdate", "updateProject", "update"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

/** Compare lock pins to remote tips. */
export function getRunOutdated(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runOutdated", "checkOutdated", "outdated"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getRunUninstall(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runUninstall", "uninstallPackages", "uninstall"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getRunPrune(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runPrune", "pruneModules", "prune"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getDepsList(): (options: Record<string, unknown>) => unknown {
  return pickExport(["listDeps", "depsList", "runDepsList"]) as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function getDepsTree(): (options: Record<string, unknown>) => unknown {
  return pickExport(["treeDeps", "depsTree", "runDepsTree"]) as (
    options: Record<string, unknown>,
  ) => unknown;
}

/** Optional SHOULD (rs-005); returns undefined when deferred. */
export function getDepsWhyOptional(): ((options: Record<string, unknown>) => unknown) | undefined {
  const c = core as Record<string, unknown>;
  for (const name of ["whyDeps", "depsWhy", "runDepsWhy"] as const) {
    if (typeof c[name] === "function") {
      return c[name] as (options: Record<string, unknown>) => unknown;
    }
  }
  return undefined;
}

export function getRunAuditCi(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runAuditCi", "auditCi", "runAudit"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getRunDoctor(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runDoctor", "doctor", "checkDoctor"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function writeDoctorProject(cwd: string, name: string): void {
  writeText(join(cwd, "bapm.yml"), `name: ${name}\nversion: 9.9.9\ndependencies:\n  apm: []\n`);
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"
dependencies:
  - name: leaf
    repo_url: local:leaf
    source: local
    version: "0.0.1"
  - name: other
    repo_url: github.com/example/other
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
`,
  );
}

export function ensureModulesDir(cwd: string, entries: string[] = ["pkg-a"]): void {
  const root = modulesDir(cwd);
  ensureDir(root);
  for (const name of entries) {
    ensureDir(join(root, name));
  }
}

export function checksOf(result: unknown): Array<Record<string, unknown>> {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.checks)) return r.checks as Array<Record<string, unknown>>;
  }
  return [];
}

export function lineForCheck(text: string, name: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => new RegExp(`^(PASS|FAIL)\\t${name}\\t`).test(l));
}

export function messageOf(result: unknown, name: string): string {
  const fromChecks = checksOf(result).find((c) => asText(c.name) === name);
  if (fromChecks && typeof fromChecks.message === "string") return fromChecks.message;
  const line = lineForCheck(textOf(result), name);
  return line?.split("\t")[2] ?? "";
}

export const MARKETPLACE_NAME_PATTERN =
  /marketplace|format|duplicate|version-alignment|executable-trust|executable.?trust/i;

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function statusOf(row: Record<string, unknown>): string {
  return asText(row.status ?? row.state ?? row.result ?? "").toLowerCase();
}

export function exitCodeOf(result: unknown): number {
  if (typeof result === "number") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["exitCode", "code", "status", "ok"] as const) {
      if (key === "ok" && typeof r.ok === "boolean") return r.ok ? 0 : 1;
      if (typeof r[key] === "number") return r[key] as number;
    }
  }
  throw new TypeError("expected numeric exit code or { exitCode | code | status | ok }");
}

function fingerprintTree(root: string): string {
  const parts: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const childRel = rel ? `${rel}/${name}` : name;
      const st = statSync(full);
      if (st.isDirectory()) walk(full, childRel);
      else {
        const body = readFileSync(full);
        parts.push(`${childRel}:${st.size}:${createHash("sha256").update(body).digest("hex")}`);
      }
    }
  };
  if (existsSync(root)) walk(root, "");
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

/** Bit-identical contract over lock / modules / manifest / common target roots. */
export function projectFingerprint(cwd: string): string {
  const keys = [
    "bapm.yml",
    "apm.yml",
    "bapm.lock.yaml",
    "apm.lock.yaml",
    "apm_modules",
    "bapm_modules",
    ".agents",
    ".cursor",
    ".github",
  ];
  const parts: string[] = [];
  for (const key of keys) {
    const full = join(cwd, key);
    if (!existsSync(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) parts.push(`${key}:dir:${fingerprintTree(full)}`);
    else {
      const body = readFileSync(full);
      parts.push(`${key}:file:${createHash("sha256").update(body).digest("hex")}`);
    }
  }
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["rows", "packages", "dependencies", "items", "report"] as const) {
      if (Array.isArray(r[key])) return r[key] as Record<string, unknown>[];
    }
  }
  throw new TypeError("expected rows array or { rows | packages | dependencies | items }");
}

export function textOf(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["text", "output", "stdout", "message", "plan"] as const) {
      if (typeof r[key] === "string") return r[key] as string;
      if (Array.isArray(r[key])) return (r[key] as unknown[]).map(String).join("\n");
    }
  }
  return asText(result ?? "");
}

export function diagnosticsText(result: unknown): string {
  if (!result || typeof result !== "object") return textOf(result);
  const r = result as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["diagnostics", "errors", "violations", "messages", "findings"] as const) {
    if (Array.isArray(r[key])) parts.push(...(r[key] as unknown[]).map(String));
    else if (typeof r[key] === "string") parts.push(r[key] as string);
  }
  parts.push(textOf(result));
  return parts.join("\n");
}

export function pinOf(dep: Record<string, unknown>): string {
  return asText(
    dep.resolved_commit ??
      dep.resolvedCommit ??
      dep.commit ??
      dep.resolved_tag ??
      dep.version ??
      "",
  );
}

export function nameOfDep(dep: Record<string, unknown>): string {
  return asText(dep.name ?? dep.id ?? dep.repo_url ?? dep.repoUrl ?? "");
}

export function readManifestText(cwd: string): string {
  for (const name of ["bapm.yml", "apm.yml"] as const) {
    try {
      return readFileSync(join(cwd, name), "utf8");
    } catch {
      /* try next */
    }
  }
  throw new Error("expected manifest on disk");
}

export function loadLockDeps(cwd: string): Record<string, unknown>[] {
  if (!existingLockPath(cwd)) throw new Error("expected lockfile");
  return depsOf(lockOf(loadLockfile({ cwd })));
}

export function planOf(result: unknown): Array<Record<string, unknown>> {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.plan)) return r.plan as Array<Record<string, unknown>>;
  }
  return [];
}

export function keepPlanPattern(): RegExp {
  return /\[=\].*\bkeep\b/i;
}

export function honestEmptyChangePattern(): RegExp {
  return /no dependency changes|nothing to (?:update|change)|up to date|no updates?/i;
}

export function readUpdateTypesSource(): string {
  return readFileSync(join(coreRoot, "src/modules/Update/types.ts"), "utf8");
}

export function readUpdateRunSource(): string {
  return readFileSync(join(coreRoot, "src/modules/Update/runUpdate.ts"), "utf8");
}

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

/** Leaf path project — dry-run plan is all-keep. */
export function writeLeafFixture(cwd: string, name: string): void {
  writeManifest(
    cwd,
    "bapm.yml",
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
  );
  writeText(join(cwd, "leaf", "apm.yml"), `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
  writeLock(
    cwd,
    "bapm.lock.yaml",
    `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
  );
}

/**
 * Mixed plan fixture: git pkg that can bump + local keep (via fake tagLister).
 */
export function writeMixedPlanFixture(cwd: string): {
  ports: ReturnType<typeof createFakePorts>;
  oldCommit: string;
  newCommit: string;
} {
  const oldCommit = fakeCommit("p6g-old");
  const newCommit = fakeCommit("p6g-new");
  const ports = createFakePorts({
    tagsByRepo: {
      "example/pkg-a": [
        { tag: "v1.0.0", commit: oldCommit },
        { tag: "v1.1.0", commit: newCommit },
      ],
    },
  });

  writeManifest(
    cwd,
    "bapm.yml",
    `name: p6g-mixed\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/pkg-a.git\n      ref: "^1.0.0"\n    - path: ./leaf\n`,
  );
  writeText(join(cwd, "leaf", "apm.yml"), `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
  writeLock(
    cwd,
    "bapm.lock.yaml",
    `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/pkg-a
    name: pkg-a
    resolved_commit: "${oldCommit}"
    resolved_tag: v1.0.0
  - repo_url: local:leaf
    name: leaf
    source: local
    path: leaf
`,
  );

  return { ports, oldCommit, newCommit };
}

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
  return rows.find((r) => asText(r.name ?? "") === name);
}
