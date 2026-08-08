/**
 * Helpers for marketplace search/install suite (core). Soft-resolve @bapm/core APIs.
 */
import { asText } from "../asText.ts";
import * as core from "@bapm/core";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export type TempConfig = { configDir: string; root: string; cleanup: () => void };

export function createTempConfigDir(prefix = "bapm-mp-si-"): TempConfig {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const configDir = join(root, ".bapm");
  mkdirSync(configDir, { recursive: true });
  return {
    root,
    configDir,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

/** Local marketplace with relative plugin package. */
export function writeLocalMarketplaceTree(
  root: string,
  options?: {
    marketplaceName?: string;
    pluginName?: string;
    description?: string;
    sourceUrl?: string;
    sourceDigest?: string;
  },
): { marketplaceRoot: string; manifestPath: string; pluginDir: string } {
  const marketplaceName = options?.marketplaceName ?? "local-mp";
  const pluginName = options?.pluginName ?? "demo";
  const marketplaceRoot = join(root, "marketplaces", marketplaceName);
  const pluginDir = join(marketplaceRoot, "plugins", pluginName);
  const manifest: Record<string, unknown> = {
    name: marketplaceName,
    owner: { name: "demo-owner" },
    plugins: [
      {
        name: pluginName,
        description: options?.description ?? "Demo plugin for search/install",
        source: `./plugins/${pluginName}`,
        version: "1.0.0",
        tags: ["demo", "acceptance"],
      },
    ],
  };
  if (options?.sourceUrl) manifest.source_url = options.sourceUrl;
  if (options?.sourceDigest) manifest.source_digest = options.sourceDigest;

  const manifestPath = join(marketplaceRoot, "marketplace.json");
  writeText(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeText(
    join(pluginDir, "apm.yml"),
    `name: ${pluginName}\nversion: 1.0.0\ndependencies:\n  apm: []\n`,
  );
  writeText(
    join(pluginDir, ".apm/skills/hello/SKILL.md"),
    "---\nname: hello\n---\n# Hello from marketplace plugin\n",
  );
  return { marketplaceRoot, manifestPath, pluginDir };
}

/** Marketplace listing a github-shaped / Copilot repository plugin (no network). */
export function writeGithubShapedMarketplace(
  root: string,
  options?: { marketplaceName?: string; pluginName?: string },
): { marketplaceRoot: string; manifestPath: string } {
  const marketplaceName = options?.marketplaceName ?? "gh-mp";
  const pluginName = options?.pluginName ?? "tools";
  const marketplaceRoot = join(root, "marketplaces", marketplaceName);
  const manifestPath = join(marketplaceRoot, "marketplace.json");
  writeText(
    manifestPath,
    `${JSON.stringify(
      {
        name: marketplaceName,
        plugins: [
          {
            name: pluginName,
            description: "Github-shaped tools",
            repository: "acme/tools",
            ref: "main",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return { marketplaceRoot, manifestPath };
}

/** Registry-only plugin (no installable github/local/url) — G10 DEFER. */
export function writeRegistryOnlyMarketplace(
  root: string,
  options?: { marketplaceName?: string; pluginName?: string },
): { marketplaceRoot: string; manifestPath: string } {
  const marketplaceName = options?.marketplaceName ?? "reg-mp";
  const pluginName = options?.pluginName ?? "only-reg";
  const marketplaceRoot = join(root, "marketplaces", marketplaceName);
  const manifestPath = join(marketplaceRoot, "marketplace.json");
  writeText(
    manifestPath,
    `${JSON.stringify(
      {
        name: marketplaceName,
        plugins: [
          {
            name: pluginName,
            description: "Registry routed only",
            registry: "https://registry.example.com/packages/only-reg",
            version: "1.2.3",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return { marketplaceRoot, manifestPath };
}

/** Unsupported gitlab-ish plugin source pattern. */
export function writeUnsupportedHostMarketplace(
  root: string,
  options?: { marketplaceName?: string; pluginName?: string },
): { marketplaceRoot: string; manifestPath: string } {
  const marketplaceName = options?.marketplaceName ?? "bad-host-mp";
  const pluginName = options?.pluginName ?? "gl-tools";
  const marketplaceRoot = join(root, "marketplaces", marketplaceName);
  const manifestPath = join(marketplaceRoot, "marketplace.json");
  writeText(
    manifestPath,
    `${JSON.stringify(
      {
        name: marketplaceName,
        plugins: [
          {
            name: pluginName,
            description: "Gitlab plugin",
            source: {
              source: "url",
              url: "https://gitlab.com/acme/gl-tools.git",
            },
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return { marketplaceRoot, manifestPath };
}

export function registerLocalMarketplace(
  name: string,
  marketplaceRoot: string,
  opts: { configDir: string },
): unknown {
  const create = pickExport(
    ["createMarketplaceSource", "MarketplaceSource"],
    "createMarketplaceSource",
  );
  const add = pickExport(["addMarketplace", "registerMarketplace"], "addMarketplace");
  let source: unknown;
  try {
    source = Reflect.construct(create, [{ name, url: marketplaceRoot, path: "marketplace.json" }]);
  } catch {
    source = create({ name, url: marketplaceRoot, path: "marketplace.json" } as never);
  }
  return add(source as never, opts as never);
}

export function getParseMarketplaceRef() {
  return pickExport(["parseMarketplaceRef", "parse_marketplace_ref"], "parseMarketplaceRef") as (
    spec: string,
  ) => unknown;
}

export function getResolveMarketplacePlugin() {
  return pickExport(
    ["resolveMarketplacePlugin", "resolve_marketplace_plugin"],
    "resolveMarketplacePlugin",
  ) as (
    plugin: string,
    marketplace: string,
    versionSpec?: string | null,
    opts?: Record<string, unknown>,
  ) => unknown;
}

export function getClassifyDependencyRef() {
  return pickExport(
    ["classifyDependencyRef", "classify_dependency_ref"],
    "classifyDependencyRef",
  ) as (input: unknown) => { kind: string; [k: string]: unknown };
}

export function getResolveDependencyGraph() {
  return pickExport(
    ["resolveDependencyGraph", "resolve_dependency_graph"],
    "resolveDependencyGraph",
  ) as (options: Record<string, unknown>) => Promise<unknown>;
}

export function getLockApis() {
  return {
    load: pickExport(["loadLockfile", "load_lockfile"], "loadLockfile") as (opts: {
      cwd?: string;
      path?: string;
    }) => unknown,
    serialize: pickExport(["serializeLockfile", "serialize_lockfile"], "serializeLockfile") as (
      doc: unknown,
    ) => string,
    parse: pickExport(
      ["parseLockfile", "parseLockfileDocument", "parse_lockfile"],
      "parseLockfile",
    ) as (yaml: string) => unknown,
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  throw new TypeError(`expected object, got ${typeof value}`);
}

export function parsedRefOf(result: unknown): {
  plugin: string;
  marketplace: string;
  ref: string | null;
} {
  if (result == null) {
    return { plugin: "", marketplace: "", ref: null };
  }
  if (Array.isArray(result)) {
    return {
      plugin: asText(result[0] ?? ""),
      marketplace: asText(result[1] ?? ""),
      ref: result[2] == null || result[2] === "" ? null : asText(result[2]),
    };
  }
  const r = asRecord(result);
  const plugin = asText(r.pluginName ?? r.plugin ?? r.name ?? "");
  const marketplace = asText(r.marketplaceName ?? r.marketplace ?? "");
  const rawRef = r.ref ?? r.version ?? r.versionSpec;
  return {
    plugin,
    marketplace,
    ref: rawRef == null || rawRef === "" ? null : asText(rawRef),
  };
}

export function provenanceOf(resolution: unknown): Record<string, unknown> {
  const r = asRecord(resolution);
  if (typeof r.provenance === "function") {
    return asRecord((r.provenance as () => unknown).call(resolution));
  }
  if (r.provenance && typeof r.provenance === "object") {
    return asRecord(r.provenance);
  }
  // Flat resolution bag
  const out: Record<string, unknown> = {};
  for (const key of [
    "discovered_via",
    "marketplace_plugin_name",
    "source_url",
    "source_digest",
  ] as const) {
    if (key in r) out[key] = r[key];
  }
  if (Object.keys(out).length > 0) return out;
  throw new TypeError("expected resolution.provenance() or provenance fields");
}

export function concreteDepOf(resolution: unknown): unknown {
  const r = asRecord(resolution);
  for (const key of [
    "dependency",
    "dependencyReference",
    "dependency_reference",
    "canonical",
    "spec",
    "ref",
  ] as const) {
    if (r[key] !== undefined) return r[key];
  }
  // Some APIs return the concrete dep as the resolution itself with kind/path/git
  if ("path" in r || "git" in r || "kind" in r) return resolution;
  throw new TypeError("expected concrete dependency on marketplace resolution");
}

export function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (err && typeof err === "object" && "message" in err) {
    return asText((err as { message: unknown }).message);
  }
  return asText(err);
}

export async function expectAsyncThrowMatching(
  fn: () => unknown,
  pattern: RegExp,
): Promise<unknown> {
  let thrown: unknown;
  try {
    await Promise.resolve(fn());
  } catch (e) {
    thrown = e;
  }
  if (thrown === undefined) {
    throw new Error(`expected throw matching ${pattern}`);
  }
  // Soft-export missing should stay visible as RED machinery failure, not swallowed
  if (thrown instanceof TypeError && /expected @bapm\/core to export/i.test(thrown.message)) {
    throw thrown;
  }
  const haystack = errorText(thrown);
  if (!pattern.test(haystack)) {
    throw new Error(`expected error matching ${pattern}, got: ${haystack}`);
  }
  return thrown;
}

export function writeManifest(
  cwd: string,
  contents: string,
  filename: "bapm.yml" | "apm.yml" = "bapm.yml",
): string {
  const path = join(cwd, filename);
  writeText(path, contents);
  return path;
}

export function createTempProject(prefix = "bapm-mp-si-proj-"): {
  cwd: string;
  cleanup: () => void;
} {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

export function lockDepsOf(loaded: unknown): Record<string, unknown>[] {
  const r = asRecord(loaded);
  const doc = asRecord((r.document ?? r.lockfile ?? r.lock ?? r) as unknown);
  const deps = doc.dependencies;
  if (!Array.isArray(deps)) throw new TypeError("expected lock dependencies array");
  return deps as Record<string, unknown>[];
}

export function readLockYaml(cwd: string): string {
  for (const name of ["bapm.lock.yaml", "apm.lock.yaml"] as const) {
    const p = join(cwd, name);
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  throw new Error("expected lockfile on disk");
}

export function modulesPresent(cwd: string): boolean {
  for (const name of ["apm_modules", "bapm_modules"] as const) {
    if (existsSync(join(cwd, name))) return true;
  }
  return false;
}

export { existsSync, join, mkdirSync, readFileSync };
