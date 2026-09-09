/**
 * Helpers for install-trust-bin acceptance (RED → GREEN).
 * Specs: install-trust-bin, install-pipeline, executable-mcp-trust.
 */
import { asText } from "../../asText.ts";
import * as core from "@b-apm/core";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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
} from "../../install/helpers.ts";
import {
  buildFlatPackageZip,
  listModulesFiles,
  startMockRegistry,
  withExperimentalRegistries,
  type MockRegistry,
} from "../../registry/helpers.ts";
import {
  checklistPath,
  limitationsBlob,
  loadChecklist,
  scopeOutBlob,
} from "../../spec-conformance/sc-claims-helpers.ts";
import {
  conformanceMdPath,
  readText as readConformanceText,
} from "../../spec-conformance/helpers.ts";

export {
  createFakePorts,
  getRunInstall,
  importIntegrationApi,
  listModulesFiles,
  modulesDir,
  startMockRegistry,
  withExperimentalRegistries,
  checklistPath,
  limitationsBlob,
  loadChecklist,
  scopeOutBlob,
  conformanceMdPath,
  readConformanceText,
};
export type { MockRegistry, TempProject };

export const PKG_ID = "acme/bin-plugin";
export const PKG_OWNER = "acme";
export const PKG_REPO = "bin-plugin";
export const SKILL_NAME = "bin-skill";
export const BIN_NAME = "trust-bin-probe";
export const BIN_MARKER = "bapm-trust-bin-probe-marker\n";
export const GIT_URL = "https://github.com/acme/bin-plugin.git";

/** Conventional thin deploy root (design D3) beside skill materialize. */
export const DEFAULT_BIN_DEPLOY_ROOT = ".agents/bin";

export function createTempProject(prefix = "bapm-trust-bin-"): TempProject {
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

export function skillMd(name: string): string {
  return `---\nname: ${name}\n---\n# ${name}\n`;
}

export function packageTreeFiles(): Record<string, string> {
  return {
    [`bin/${BIN_NAME}`]: `#!/bin/sh\necho ${BIN_MARKER}`,
    [`.apm/skills/${SKILL_NAME}/SKILL.md`]: skillMd(SKILL_NAME),
  };
}

export function buildBinPluginZip(options?: { name?: string; version?: string }): Uint8Array {
  return buildFlatPackageZip({
    name: options?.name ?? PKG_ID,
    version: options?.version ?? "1.0.0",
    extraFiles: packageTreeFiles(),
  });
}

export function writeBinPluginTree(dest: string, name = PKG_ID): void {
  writeText(join(dest, "apm.yml"), `name: ${name}\nversion: 0.0.0\ndependencies:\n  apm: []\n`);
  for (const [rel, body] of Object.entries(packageTreeFiles())) {
    writeText(join(dest, rel), body);
  }
}

export function createBinPluginDownloader() {
  return {
    async download(args: { dest: string; commit?: string }): Promise<void> {
      writeBinPluginTree(args.dest);
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
  executablesYaml?: string;
}): string {
  const targetLine = options.target ? `target: ${options.target}\n` : "";
  const registries = options.registriesYaml ? `${options.registriesYaml}\n` : "";
  const executables = options.executablesYaml ? `${options.executablesYaml}\n` : "";
  return `name: ${options.name ?? "consumer"}
version: 0.0.1
${targetLine}${registries}${executables}dependencies:
  apm:
${options.depYaml}
`;
}

export function gitDepYaml(options?: { git?: string; ref?: string }): string {
  const lines = [`    - git: ${options?.git ?? GIT_URL}`];
  if (options?.ref) lines.push(`      ref: ${options.ref}`);
  return lines.join("\n");
}

export function registryDepYaml(options?: {
  id?: string;
  version?: string;
  registry?: string;
}): string {
  const id = options?.id ?? PKG_ID;
  const version = options?.version ?? "1.0.0";
  const lines = [`    - id: ${id}`, `      version: "${version}"`];
  if (options?.registry) lines.push(`      registry: ${options.registry}`);
  return lines.join("\n");
}

export function projectBinAllowYaml(packageName = PKG_ID): string {
  return `executables:
  allow:
    "${packageName}":
      bin: true
`;
}

export function projectBinDenyYaml(packageName = PKG_ID): string {
  return `executables:
  deny:
    "${packageName}":
      bin: true
`;
}

export function flattenDiagnostics(result: unknown): string {
  if (!result || typeof result !== "object") return asText(result);
  const r = result as Record<string, unknown>;
  const chunks: string[] = [];
  for (const key of ["diagnostics", "policyDiagnostics", "warnings", "messages"] as const) {
    const arr = r[key];
    if (Array.isArray(arr)) {
      for (const item of arr) chunks.push(asText(item));
    }
  }
  return chunks.join("\n");
}

/** Bin withhold/skip diagnostic (codes apply may choose; message must mention bin). */
export function hasBinWithholdDiagnostic(result: unknown): boolean {
  const blob = flattenDiagnostics(result);
  return (
    /bin/i.test(blob) && /withhold|skip|refus|consent|trust-bin|no-trust-bin|not deploy/i.test(blob)
  );
}

export function hasTrustBinWarning(result: unknown, combinedIo = ""): boolean {
  const blob = `${flattenDiagnostics(result)}\n${combinedIo}`;
  return /trust-bin|--trust-bin/i.test(blob) && /warn|consent|trust.?posture|explicit/i.test(blob);
}

/**
 * Paths where gated bin deploy is expected to land (not raw package cache alone).
 * Apply may use DEFAULT_BIN_DEPLOY_ROOT or `binDeployRoot` option.
 */
export function listDeployedBinPaths(cwd: string, options?: { binDeployRoot?: string }): string[] {
  const roots = [
    options?.binDeployRoot,
    join(cwd, DEFAULT_BIN_DEPLOY_ROOT),
    join(cwd, "bin"),
    join(cwd, ".agents", "bin"),
    join(cwd, ".bapm", "bin"),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  const found: string[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    const candidate = join(root, BIN_NAME);
    if (existsSync(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      found.push(candidate);
    }
  }

  // Also accept deploy copies under modules that sit in a dedicated `deploy/bin` lane.
  const modules = modulesDir(cwd);
  if (existsSync(modules)) {
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name);
        if (statSync(abs).isDirectory()) {
          walk(abs);
          continue;
        }
        const norm = abs.replaceAll("\\", "/");
        if (norm.endsWith(`/deploy/bin/${BIN_NAME}`) || norm.endsWith(`/.agents/bin/${BIN_NAME}`)) {
          if (!seen.has(abs)) {
            seen.add(abs);
            found.push(abs);
          }
        }
      }
    };
    walk(modules);
  }
  return found;
}

export function deployedBinExists(cwd: string, options?: { binDeployRoot?: string }): boolean {
  return listDeployedBinPaths(cwd, options).length > 0;
}

export function skillMaterialized(
  result: unknown,
  names: { name: string; type?: string }[],
): boolean {
  if (names.some((p) => p.name === SKILL_NAME)) return true;
  const blob = asText(result);
  return blob.includes(SKILL_NAME);
}

export function primitiveNames(primitives: unknown): { name: string; type: string }[] {
  const list = Array.isArray(primitives)
    ? primitives
    : primitives &&
        typeof primitives === "object" &&
        Array.isArray((primitives as { primitives?: unknown }).primitives)
      ? (primitives as { primitives: unknown[] }).primitives
      : [];
  return list
    .filter((p): p is Record<string, unknown> => p !== null && typeof p === "object")
    .map((p) => ({
      name: asText(p.name ?? p.id ?? ""),
      type: asText(p.type ?? p.kind ?? "skill"),
    }));
}

export async function installBinPlugin(
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
  const binDeployRoot =
    typeof options.binDeployRoot === "string"
      ? options.binDeployRoot
      : join(cwd, DEFAULT_BIN_DEPLOY_ROOT);
  mkdirSync(binDeployRoot, { recursive: true });
  const result = await runInstall({
    cwd,
    frozen: false,
    integrationRegistry: registry,
    registry,
    activeTargets: ["cursor"],
    forcedTarget: "cursor",
    gitRemote: ports.gitRemote,
    tagLister: ports.tagLister,
    downloader: options.downloader ?? createBinPluginDownloader(),
    binDeployRoot,
    ...options,
  });
  return {
    result,
    names,
    skillNames: names.filter((p) => !p.type || p.type === "skill").map((p) => p.name),
  };
}

export async function installRegistryBinPlugin(
  cwd: string,
  registry: MockRegistry,
  options: Record<string, unknown> = {},
): Promise<{
  result: unknown;
  names: { name: string; type: string }[];
  skillNames: string[];
}> {
  const ports = createFakePorts();
  return withExperimentalRegistries(() =>
    installBinPlugin(cwd, {
      experimentalRegistries: true,
      registryBaseUrl: registry.baseUrl,
      downloader: ports.downloader,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      ...options,
    }),
  );
}

/** Optional pure helper apply may export; acceptance prefers install observability. */
export function tryGetResolveBinDeployConsent():
  | ((options: Record<string, unknown>) => {
      deploy?: boolean;
      allowed?: boolean;
      withhold?: boolean;
      warn?: boolean;
      outcome?: string;
      [key: string]: unknown;
    })
  | undefined {
  const c = core as Record<string, unknown>;
  for (const name of [
    "resolveBinDeployConsent",
    "resolveEffectiveBinDeploy",
    "evaluateBinDeployConsent",
  ]) {
    if (typeof c[name] === "function") {
      return c[name] as ReturnType<typeof tryGetResolveBinDeployConsent>;
    }
  }
  return undefined;
}

export function limitationsHonestyBlob(): string {
  const doc = loadChecklist();
  const md = existsSync(conformanceMdPath) ? readConformanceText(conformanceMdPath) : "";
  return `${limitationsBlob(doc)}\n${scopeOutBlob(doc)}\n${md}`;
}

export function writeOrgDenyPolicy(cwd: string, packageName = PKG_ID): string {
  const path = join(cwd, "bapm-policy.yml");
  writeText(
    path,
    `name: org-deny-bin
enforcement: warn
executables:
  deny:
    - ${packageName}
`,
  );
  return path;
}

export function writeOrgDenyAllPolicy(cwd: string): string {
  const path = join(cwd, "bapm-policy.yml");
  writeText(
    path,
    `name: org-deny-all
enforcement: warn
executables:
  deny_all: true
`,
  );
  return path;
}
