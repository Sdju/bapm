/**
 * Helpers for object-form skills/targets subset tests (promoted from acceptance).
 * Specs: deps-object-subset, manifest-yaml-validate, dependency-resolve,
 * install-pipeline, openapm-conformance-statement.
 */
import { asText } from "../asText.ts";
import * as core from "@b-apm/core";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createFakePorts,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  getRunInstall,
  importIntegrationApi,
  modulesDir,
  type TempProject,
} from "../install/helpers.ts";
import {
  buildFlatPackageZip,
  listModulesFiles,
  startMockRegistry,
  withExperimentalRegistries,
  type MockRegistry,
} from "../registry/helpers.ts";
import { listFilesRecursive } from "../resolve/helpers.ts";

export {
  createFakePorts,
  getRunInstall,
  listFilesRecursive,
  listModulesFiles,
  modulesDir,
  startMockRegistry,
  withExperimentalRegistries,
};
export type { MockRegistry, TempProject };

export const KEEP_SKILL = "keep-me";
export const DROP_SKILL = "drop-me";
export const STALE_SKILL = "gone";
export const KEEP_COMMAND = "also-cmd";
export const TOOLKIT_ID = "acme/toolkit";
export const DEMO_ID = "acme/demo-pkg";
export const GIT_URL = "https://github.com/acme/toolkit.git";

export function createTempProject(prefix = "bapm-deps-subset-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writeManifestYaml(cwd: string, body: string, filename = "bapm.yml"): string {
  const path = join(cwd, filename);
  writeText(path, body);
  return path;
}

export function readProjectManifest(cwd: string): string {
  for (const name of ["bapm.yml", "apm.yml"] as const) {
    const path = join(cwd, name);
    try {
      return readFileSync(path, "utf8");
    } catch {
      /* try next */
    }
  }
  throw new Error("expected project manifest after write/install");
}

export function skillMd(name: string): string {
  return `---\nname: ${name}\n---\n# ${name}\n`;
}

export function commandPrompt(name: string): string {
  return `---\ndescription: ${name} command\n---\n# ${name}\n`;
}

export function toolkitTreeFiles(): Record<string, string> {
  return {
    [`.apm/skills/${KEEP_SKILL}/SKILL.md`]: skillMd(KEEP_SKILL),
    [`.apm/skills/${DROP_SKILL}/SKILL.md`]: skillMd(DROP_SKILL),
    [`.apm/prompts/${KEEP_COMMAND}.prompt.md`]: commandPrompt(KEEP_COMMAND),
    "extra.txt": "full-tree-marker\n",
  };
}

/** Registry zip with two skills, one command, and a non-skill marker file. */
export function buildToolkitZip(options?: { name?: string; version?: string }): Uint8Array {
  const files = toolkitTreeFiles();
  return buildFlatPackageZip({
    name: options?.name ?? TOOLKIT_ID,
    version: options?.version ?? "1.0.0",
    extraFiles: files,
  });
}

export function writeToolkitTree(dest: string, name = "toolkit"): void {
  writeText(join(dest, "apm.yml"), `name: ${name}\nversion: 0.0.0\ndependencies:\n  apm: []\n`);
  const files = toolkitTreeFiles();
  for (const [rel, body] of Object.entries(files)) {
    writeText(join(dest, rel), body);
  }
}

/** Downloader that always materializes the two-skill toolkit tree. */
export function createToolkitDownloader() {
  return {
    async download(args: { dest: string; commit?: string }): Promise<void> {
      writeToolkitTree(args.dest);
      if (args.commit) {
        writeText(join(args.dest, ".bapm-resolved-commit"), args.commit);
      }
    },
  };
}

export function consumerManifest(options: {
  name?: string;
  depYaml: string;
  target?: string;
  registriesYaml?: string;
}): string {
  const targetLine = options.target ? `target: ${options.target}\n` : "";
  const registries = options.registriesYaml ? `${options.registriesYaml}\n` : "";
  return `name: ${options.name ?? "consumer"}
version: 0.0.1
${targetLine}${registries}dependencies:
  apm:
${options.depYaml}
`;
}

export function registryIdDepYaml(options: {
  id?: string;
  version?: string;
  skills?: string[];
  targets?: string[];
  registry?: string;
}): string {
  const id = options.id ?? TOOLKIT_ID;
  const version = options.version ?? "1.0.0";
  const lines = [`    - id: ${id}`, `      version: "${version}"`];
  if (options.registry) lines.push(`      registry: ${options.registry}`);
  appendSubsetYaml(lines, options.skills, options.targets);
  return lines.join("\n");
}

export function gitObjectDepYaml(options: {
  git?: string;
  ref?: string;
  skills?: string[];
  targets?: string[];
}): string {
  const lines = [`    - git: ${options.git ?? GIT_URL}`];
  if (options.ref) lines.push(`      ref: ${options.ref}`);
  appendSubsetYaml(lines, options.skills, options.targets);
  return lines.join("\n");
}

function appendSubsetYaml(lines: string[], skills?: string[], targets?: string[]): void {
  if (skills) lines.push(`      skills: [${skills.join(", ")}]`);
  if (targets) lines.push(`      targets: [${targets.join(", ")}]`);
}

export function baseManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "consumer",
    version: "0.0.1",
    dependencies: { apm: [] },
    ...overrides,
  };
}

export function apmObjectEntries(document: unknown): Record<string, unknown>[] {
  if (!document || typeof document !== "object") return [];
  const deps = (document as { dependencies?: { apm?: unknown } }).dependencies;
  const apm = deps?.apm;
  if (!Array.isArray(apm)) return [];
  return apm.filter((e) => e !== null && typeof e === "object") as Record<string, unknown>[];
}

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`expected string list, got ${asText(value)}`);
  }
  if (!value.every((item) => typeof item === "string")) {
    throw new TypeError(`expected string[], got ${asText(value)}`);
  }
  return value as string[];
}

type AnyFn = (...args: never[]) => unknown;

function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @b-apm/core to export one of [${names.join(", ")}] (${label})`);
}

/** Identity-aware structured merge used by package-ref / install write-back (req-mf-024). */
export function getMergeApmDependencyUpdate(): (
  document: Record<string, unknown>,
  incoming: unknown,
) => Record<string, unknown> {
  return pickExport(
    [
      "mergeApmDependencyUpdate",
      "mergeStructuredApmDependency",
      "applyStructuredApmDependencyUpdate",
      "mergeRegistryIdentityEntry",
    ],
    "structured APM dependency merge (req-mf-024)",
  ) as (document: Record<string, unknown>, incoming: unknown) => Record<string, unknown>;
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
    /is not a function|expected @b-apm\/core/i.test(thrown.message)
  ) {
    throw thrown;
  }
  const message =
    thrown instanceof Error
      ? thrown.message
      : typeof thrown === "object" && thrown !== null && "message" in thrown
        ? asText((thrown as { message: unknown }).message)
        : asText(thrown);
  const code =
    typeof thrown === "object" && thrown !== null && "code" in thrown
      ? asText((thrown as { code: unknown }).code)
      : "";
  const haystack = `${message}\n${code}`;
  if (!pattern.test(haystack)) {
    throw new Error(`expected error matching ${pattern}, got: ${haystack}`);
  }
  return thrown;
}

export function flattenDiagnostics(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  const bags = [r.diagnostics, r.warnings, r.messages, r.policyDiagnostics];
  const parts: string[] = [];
  for (const bag of bags) {
    if (!Array.isArray(bag)) continue;
    for (const item of bag) parts.push(asText(item));
  }
  return parts.join("\n");
}

export function primitiveNames(payload: unknown): { name: string; type: string }[] {
  const list = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { primitives?: unknown }).primitives)
      ? ((payload as { primitives: unknown[] }).primitives ?? [])
      : [];
  return (list as Record<string, unknown>[]).map((p) => ({
    name: asText(p.name ?? p.id ?? p.slug ?? ""),
    type: asText(p.type ?? p.kind ?? p.primitiveType ?? ""),
  }));
}

export async function installWithCursorSpy(
  cwd: string,
  options: Record<string, unknown> = {},
): Promise<{
  result: unknown;
  names: { name: string; type: string }[];
  skillNames: string[];
}> {
  const api = await importIntegrationApi();
  const registry = getCreateIntegrationRegistry(api)();
  const register = getRegisterIntegration(api, registry);
  const names: { name: string; type: string }[] = [];
  register({
    id: "cursor",
    deployRoots: [".agents/skills"],
    detect: () => true,
    materialize: async (primitives: unknown) => {
      names.push(...primitiveNames(primitives));
    },
  });
  const ports = createFakePorts();
  const runInstall = getRunInstall();
  const result = await runInstall({
    cwd,
    frozen: false,
    integrationRegistry: registry,
    registry,
    activeTargets: ["cursor"],
    forcedTarget: "cursor",
    gitRemote: ports.gitRemote,
    tagLister: ports.tagLister,
    downloader: options.downloader ?? createToolkitDownloader(),
    ...options,
  });
  return {
    result,
    names,
    skillNames: names.filter((p) => !p.type || p.type === "skill").map((p) => p.name),
  };
}

export async function installRegistryToolkit(
  cwd: string,
  registry: MockRegistry,
  options: Record<string, unknown> = {},
): Promise<{ result: unknown; names: { name: string; type: string }[]; skillNames: string[] }> {
  const ports = createFakePorts();
  return withExperimentalRegistries(() =>
    installWithCursorSpy(cwd, {
      experimentalRegistries: true,
      registryBaseUrl: registry.baseUrl,
      downloader: ports.downloader,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      ...options,
    }),
  );
}
