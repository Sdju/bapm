/**
 * M8 governance/policy acceptance helpers — pickExport for TDD RED APIs.
 */
import * as core from "@bapm/core";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");
export const repoRoot = resolve(coreRoot, "../..");

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-m8-core-"): TempProject {
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
  filename: "apm-policy.yml" | "bapm-policy.yml",
  contents: string,
): string {
  const path = join(cwd, filename);
  writeFileSync(path, contents, "utf8");
  return path;
}

export function writeManifest(
  cwd: string,
  filename: "apm.yml" | "bapm.yml",
  contents: string,
): string {
  const path = join(cwd, filename);
  writeFileSync(path, contents, "utf8");
  return path;
}

/** Leaf path-dep project; leaf package name is `leaf` (deny target in gate fixtures). */
export function writeLeafProject(cwd: string, name: string): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
  );
  writeText(join(cwd, "leaf", "apm.yml"), `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
}

export const BLOCK_DENY_LEAF_POLICY = `name: deny-leaf
enforcement: block
dependencies:
  deny:
    - leaf
`;

export const WARN_DENY_LEAF_POLICY = `name: warn-deny-leaf
enforcement: warn
dependencies:
  deny:
    - leaf
`;

export const OFF_DENY_LEAF_POLICY = `name: off-deny-leaf
enforcement: off
dependencies:
  deny:
    - leaf
`;

export const MINIMAL_WARN_POLICY = `name: org
enforcement: warn
`;

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

export function getApmPolicyFile(): string {
  const v = pickValue(["APM_POLICY_FILE"], "M8 APM_POLICY_FILE");
  if (typeof v !== "string") throw new TypeError("APM_POLICY_FILE must be string");
  return v;
}

export function getBapmPolicyFile(): string {
  const v = pickValue(["BAPM_POLICY_FILE"], "M8 BAPM_POLICY_FILE");
  if (typeof v !== "string") throw new TypeError("BAPM_POLICY_FILE must be string");
  return v;
}

export function getDiscoverPolicyPath(): (options: Record<string, unknown>) => unknown {
  return pickExport(["discoverPolicyPath", "discoverLocalPolicyPath"], "M8 policy discovery") as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function getParsePolicy(): (input: unknown) => unknown {
  return pickExport(["parsePolicy", "parsePolicyDocument"], "M8 policy parse") as (
    input: unknown,
  ) => unknown;
}

export function getLoadPolicy(): (options: Record<string, unknown>) => unknown {
  return pickExport(["loadPolicy"], "M8 policy load") as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function getEvaluatePolicy(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["evaluateInstallPolicy", "evaluatePolicy", "evaluatePolicyRules"],
    "M8 policy evaluate",
  ) as (options: Record<string, unknown>) => unknown;
}

export function getDefaultPolicyProviders(): unknown {
  return pickValue(
    ["DEFAULT_POLICY_PROVIDERS", "POLICY_DISCOVERY_PROVIDERS", "defaultPolicyProviders"],
    "M8 default policy providers",
  );
}

export function getRunInstall(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runInstall", "installProject"], "M8 install gate") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
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
  const haystack = message;
  if (!pattern.test(haystack)) {
    throw new Error(`expected error matching ${pattern}, got: ${haystack}`);
  }
  return thrown;
}

/** Pull policy document from parse/load result regardless of bag shape. */
export function policyOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected policy parse/load result object");
  }
  const r = result as Record<string, unknown>;
  const doc = (r.document ?? r.policy ?? r) as Record<string, unknown>;
  if (doc === null || typeof doc !== "object") {
    throw new TypeError("expected document/policy object on load result");
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
  if (r.ok === false && (r.blocking === true || r.mode === "block")) return true;
  return false;
}

export function violationsOf(result: unknown): unknown[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  for (const key of ["violations", "errors", "findings"] as const) {
    if (Array.isArray(r[key])) return r[key] as unknown[];
  }
  return [];
}

export function listBapmTargetPackageNames(): string[] {
  const packagesDir = join(repoRoot, "packages");
  if (!existsSync(packagesDir)) return [];
  const names: string[] = [];
  for (const entry of readdirSync(packagesDir)) {
    const dir = join(packagesDir, entry);
    if (!statSync(dir).isDirectory()) continue;
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    if (typeof pkg.name === "string" && pkg.name.startsWith("bapm-target-")) {
      names.push(pkg.name);
    }
  }
  return names.sort();
}

export function discoveredPathOf(result: unknown): string | undefined {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return undefined;
  const r = result as Record<string, unknown>;
  if (typeof r.path === "string") return r.path;
  if (r.absent === true || r.found === false) return undefined;
  return undefined;
}

export function isAbsentDiscovery(result: unknown): boolean {
  if (result === null || result === undefined) return true;
  if (typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.absent === true || r.found === false || r.path === null) return true;
  }
  return false;
}
