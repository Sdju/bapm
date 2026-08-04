/**
 * p4-governance-remote-extends acceptance helpers.
 * pickExport for TDD RED APIs (resolve/merge/remote) that apply will implement.
 */
import * as core from "@bapm/core";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../../..");
export const repoRoot = resolve(coreRoot, "../..");

export const fixtureRoot = join(repoRoot, "tests/fixtures/spec-conformance");
export const conformanceMdPath = join(repoRoot, "CONFORMANCE.md");
export const conformanceJsonPath = join(repoRoot, "CONFORMANCE.json");

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-p4-gov-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function writeText(path: string, contents: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, contents, "utf8");
}

export function writePolicy(
  cwd: string,
  filename: "apm-policy.yml" | "bapm-policy.yml" | string,
  contents: string,
): string {
  const path = join(cwd, filename);
  writeFileSync(path, contents, "utf8");
  return path;
}

export function writeLeafProject(cwd: string, name: string): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
  );
  writeText(join(cwd, "leaf", "apm.yml"), `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
}

export function fixturePath(...parts: string[]): string {
  return join(fixtureRoot, ...parts);
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function loadJsonFile(path: string): unknown {
  return JSON.parse(readText(path)) as unknown;
}

type AnyFn = (...args: never[]) => unknown;

function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

function pickValue(names: string[], label: string): unknown {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    if (name in c && c[name] !== undefined) return c[name];
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getDefaultPolicyProviders(): unknown {
  return pickValue(
    ["DEFAULT_POLICY_PROVIDERS", "POLICY_DISCOVERY_PROVIDERS", "defaultPolicyProviders"],
    "P4 default policy providers",
  );
}

export function getParsePolicy(): (input: unknown) => unknown {
  return pickExport(["parsePolicy", "parsePolicyDocument"], "P4 policy parse") as (
    input: unknown,
  ) => unknown;
}

export function getResolvePolicyChain(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["resolvePolicyChain", "resolveExtends", "resolvePolicyExtends", "mergePolicyChain"],
    "P4 extends resolve",
  ) as (options: Record<string, unknown>) => unknown;
}

export function getMergePolicies(): (parent: unknown, child: unknown) => unknown {
  return pickExport(["mergePolicies", "mergePolicyDocuments", "mergePolicy"], "P4 §6.4 merge") as (
    parent: unknown,
    child: unknown,
  ) => unknown;
}

export function getHostClassOf(): (input: unknown) => unknown {
  return pickExport(
    ["hostClassOf", "policyHostClass", "hostClassForPolicy", "resolveHostClass"],
    "P4 host-class pin",
  ) as (input: unknown) => unknown;
}

export function getSelectProjectRemote(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["selectProjectRemote", "selectGitRemoteForPolicy", "resolveProjectRemote"],
    "P4 pl-012 remote selection",
  ) as (options: Record<string, unknown>) => unknown;
}

export function getDiscoverPolicyProviders(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["discoverPolicyWithProviders", "runPolicyDiscovery", "discoverPolicyProviders"],
    "P4 ordered discovery providers",
  ) as (options: Record<string, unknown>) => unknown;
}

export function getRunPolicyGate(): (options: Record<string, unknown>) => unknown {
  return pickExport(["runPolicyGate", "assertPolicyGateAllows"], "P4 policy gate") as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function getRunInstall(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runInstall", "installProject"], "P4 install gate") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getLoadPolicy(): (options: Record<string, unknown>) => unknown {
  return pickExport(["loadPolicy"], "P4 policy load") as (options: Record<string, unknown>) => unknown;
}

export function modulesDir(cwd: string): string {
  const name =
    typeof (core as Record<string, unknown>).APM_MODULES_DIR === "string"
      ? String((core as Record<string, unknown>).APM_MODULES_DIR)
      : "apm_modules";
  return join(cwd, name);
}

export function hasModulesContent(cwd: string): boolean {
  const dir = modulesDir(cwd);
  if (!existsSync(dir)) return false;
  return readdirSync(dir).length > 0;
}

export function hasLockFile(cwd: string): boolean {
  return existsSync(join(cwd, "bapm.lock.yaml")) || existsSync(join(cwd, "apm.lock.yaml"));
}

export function policyOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected policy parse/load/resolve result object");
  }
  const r = result as Record<string, unknown>;
  const doc = (r.document ?? r.policy ?? r.effective ?? r.effectivePolicy ?? r) as Record<
    string,
    unknown
  >;
  if (doc === null || typeof doc !== "object") {
    throw new TypeError("expected document/policy/effective object on result");
  }
  return doc;
}

export function warningsOf(result: unknown): unknown[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  for (const key of ["warnings", "diagnostics", "parseWarnings"] as const) {
    if (Array.isArray(r[key])) return r[key] as unknown[];
  }
  return [];
}

export function isBlocking(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as Record<string, unknown>;
  if (r.blocking === true || r.blocked === true) return true;
  if (r.outcome === "block" || r.enforcementOutcome === "block") return true;
  return false;
}

export function expectThrowsMatching(fn: () => unknown, pattern: RegExp): unknown {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  if (thrown === undefined) {
    throw new Error(`expected throw matching ${pattern}`);
  }
  if (
    thrown instanceof TypeError &&
    /is not a function|expected @bapm\/core/i.test(thrown.message)
  ) {
    throw thrown;
  }
  const message =
    thrown instanceof Error
      ? thrown.message
      : typeof thrown === "object" && thrown !== null && "message" in thrown
        ? String((thrown as { message: unknown }).message)
        : String(thrown);
  const code =
    typeof thrown === "object" && thrown !== null && "code" in thrown
      ? String((thrown as { code: unknown }).code)
      : "";
  const haystack = `${message}\n${code}`;
  if (!pattern.test(haystack)) {
    throw new Error(`expected error matching ${pattern}, got: ${haystack}`);
  }
  return thrown;
}

export async function expectRejectsMatching(
  fn: () => Promise<unknown>,
  pattern: RegExp,
): Promise<unknown> {
  let thrown: unknown;
  try {
    await fn();
  } catch (e) {
    thrown = e;
  }
  if (thrown === undefined) {
    throw new Error(`expected reject matching ${pattern}`);
  }
  if (
    thrown instanceof TypeError &&
    /is not a function|expected @bapm\/core/i.test(thrown.message)
  ) {
    throw thrown;
  }
  const message =
    thrown instanceof Error
      ? thrown.message
      : typeof thrown === "object" && thrown !== null && "message" in thrown
        ? String((thrown as { message: unknown }).message)
        : String(thrown);
  if (!pattern.test(message)) {
    throw new Error(`expected error matching ${pattern}, got: ${message}`);
  }
  return thrown;
}

export function providersList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (Array.isArray(o.providers)) return o.providers.map(String);
    if (Array.isArray(o.default)) return o.default.map(String);
  }
  throw new TypeError(`expected provider list, got ${typeof value}`);
}
