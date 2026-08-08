/**
 * Registry distribution test helpers — mock HTTP registry + pickExport.
 */
import { asText } from "../asText.ts";
import * as core from "@bapm/core";
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
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
import { dirname, join } from "node:path";
import { zipSync, unzipSync } from "fflate";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-m10-core-"): TempProject {
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

export function writeManifest(
  cwd: string,
  filename: "apm.yml" | "bapm.yml",
  contents: string,
): string {
  const path = join(cwd, filename);
  writeFileSync(path, contents, "utf8");
  return path;
}

export function writeLock(
  cwd: string,
  filename: "apm.lock.yaml" | "bapm.lock.yaml",
  contents: string,
): string {
  const path = join(cwd, filename);
  writeFileSync(path, contents, "utf8");
  return path;
}

export function sha256Hex(content: string | Uint8Array | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function sha256Digest(content: string | Uint8Array | Buffer): string {
  return `sha256:${sha256Hex(content)}`;
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Flat registry package zip: apm.yml + .apm/** at archive root. */
export function buildFlatPackageZip(options?: {
  name?: string;
  version?: string;
  extraFiles?: Record<string, string>;
}): Uint8Array {
  const name = options?.name ?? "contoso/demo";
  const version = options?.version ?? "1.0.0";
  const files: Record<string, Uint8Array> = {
    "apm.yml": utf8(`name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`),
    ".apm/keep.txt": utf8("registry-package\n"),
  };
  for (const [path, contents] of Object.entries(options?.extraFiles ?? {})) {
    files[path] = utf8(contents);
  }
  return zipSync(files, { level: 6 });
}

export function listZipPaths(bytes: Uint8Array): string[] {
  return Object.keys(unzipSync(bytes)).sort();
}

export type MockVersion = {
  version: string;
  /** Bytes served on download. */
  bytes: Uint8Array;
  /** Advertised digest (may intentionally mismatch bytes for lk-013). */
  digest?: string;
  published_at?: string;
};

export type MockRegistryPackage = {
  owner: string;
  repo: string;
  versions: MockVersion[];
};

export type RecordedRequest = {
  method: string;
  url: string;
  authorization: string | undefined;
  body: Buffer;
};

export type MockRegistry = {
  baseUrl: string;
  port: number;
  requests: RecordedRequest[];
  puts: RecordedRequest[];
  close: () => Promise<void>;
  setPutStatus: (status: number) => void;
  setRequireAuth: (required: boolean) => void;
};

export async function startMockRegistry(options?: {
  packages?: MockRegistryPackage[];
  requireAuth?: boolean;
  token?: string;
  /** Default PUT response status (2xx success). */
  putStatus?: number;
}): Promise<MockRegistry> {
  const packages = options?.packages ?? [];
  const token = options?.token ?? "test-token";
  let requireAuth = options?.requireAuth === true;
  let putStatus = options?.putStatus ?? 201;
  const requests: RecordedRequest[] = [];
  const puts: RecordedRequest[] = [];

  const findPkg = (owner: string, repo: string) =>
    packages.find((p) => p.owner === owner && p.repo === repo);

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    const url = req.url ?? "/";
    const method = (req.method ?? "GET").toUpperCase();
    const authorization = req.headers.authorization;
    const recorded: RecordedRequest = { method, url, authorization, body };
    requests.push(recorded);

    if (requireAuth) {
      const expected = `Bearer ${token}`;
      if (authorization !== expected) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
    }

    const listMatch = url.match(/^\/v1\/packages\/([^/]+)\/([^/]+)\/versions\/?$/);
    if (method === "GET" && listMatch) {
      const pkg = findPkg(decodeURIComponent(listMatch[1]!), decodeURIComponent(listMatch[2]!));
      if (!pkg) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
        return;
      }
      const versions = pkg.versions.map((v) => ({
        version: v.version,
        digest: v.digest ?? sha256Digest(v.bytes),
        published_at: v.published_at ?? "2026-01-01T00:00:00Z",
      }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ versions }));
      return;
    }

    const downloadMatch = url.match(
      /^\/v1\/packages\/([^/]+)\/([^/]+)\/versions\/([^/]+)\/download\/?$/,
    );
    if (method === "GET" && downloadMatch) {
      const pkg = findPkg(
        decodeURIComponent(downloadMatch[1]!),
        decodeURIComponent(downloadMatch[2]!),
      );
      const version = decodeURIComponent(downloadMatch[3]!);
      const entry = pkg?.versions.find((v) => v.version === version);
      if (!entry) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "version not found" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/zip" });
      res.end(Buffer.from(entry.bytes));
      return;
    }

    const putMatch = url.match(/^\/v1\/packages\/([^/]+)\/([^/]+)\/versions\/([^/]+)\/?$/);
    if (method === "PUT" && putMatch) {
      puts.push(recorded);
      if (putStatus === 409) {
        res.writeHead(409, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "version already exists" }));
        return;
      }
      if (putStatus === 422) {
        res.writeHead(422, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "validation failed" }));
        return;
      }
      if (putStatus === 401 || putStatus === 403) {
        res.writeHead(putStatus, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "auth required" }));
        return;
      }
      res.writeHead(putStatus, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `no route ${method} ${url}` }));
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });

  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("expected TCP address for mock registry");
  }

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    port: addr.port,
    requests,
    puts,
    setPutStatus: (status: number) => {
      putStatus = status;
    },
    setRequireAuth: (required: boolean) => {
      requireAuth = required;
    },
    close: () =>
      new Promise<void>((resolveClose, reject) => {
        server.close((err) => (err ? reject(err) : resolveClose()));
      }),
  };
}

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export function pickValue(names: string[], label: string): unknown {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    if (name in c && c[name] !== undefined) return c[name];
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

/** Registry HTTP client factory (M10). */
export function getCreateIntegrationRegistryClient(): (
  options?: Record<string, unknown>,
) => unknown {
  return pickExport(
    ["createRegistryClient", "createRegistryHttpClient", "createPackageRegistryClient"],
    "M10 registry HTTP client",
  ) as (options?: Record<string, unknown>) => unknown;
}

export function getResolveAndLock(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["resolveAndLock"], "M10 resolveAndLock") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getRunInstall(): (options: Record<string, unknown>) => Promise<unknown> {
  const runInstall = pickExport(["runInstall", "installProject"], "M10 install") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
  return (options) =>
    runInstall({
      integrationRegistry: legacyIntegrationRegistry,
      registry: legacyIntegrationRegistry,
      ...options,
    });
}

const legacyTarget = {
  id: "legacy",
  deployRoots: [".agents", ".cursor"],
  detect: () => true,
  materialize: async () => ({ targetId: "legacy", deployedFiles: [] }),
};

const legacyIntegrationRegistry = {
  register: () => {},
  list: () => [legacyTarget],
  get: (id: string) => (id === legacyTarget.id ? legacyTarget : undefined),
  getAll: () => [legacyTarget],
  detect: async () => ({ detectedIds: [legacyTarget.id], diagnostics: [] }),
};

export function getBuildPublishArchive(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    [
      "buildPublishArchive",
      "createPublishArchive",
      "packPublishArchive",
      "buildRegistryPublishZip",
    ],
    "M10 flat publish archive",
  ) as (options: Record<string, unknown>) => unknown;
}

/** Registry package materialize (digest → safe-extract). */
export function getMaterializeRegistryArchive(): (options: {
  cwd: string;
  dest: string;
  bytes: Uint8Array;
  expectedDigest: string;
  label?: string;
}) => void {
  return pickExport(
    ["materializeRegistryArchive", "materializeRegistryPackage"],
    "Registry materialize",
  ) as (options: {
    cwd: string;
    dest: string;
    bytes: Uint8Array;
    expectedDigest: string;
    label?: string;
  }) => void;
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

export function getCheckSelfUpdate(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["checkSelfUpdate", "compareSelfUpdate", "runSelfUpdateCheck", "fetchLatestCliVersion"],
    "M10 self-update check",
  ) as (options: Record<string, unknown>) => unknown;
}

export function modulesDir(cwd: string): string {
  const name =
    typeof (core as Record<string, unknown>).APM_MODULES_DIR === "string"
      ? asText((core as Record<string, unknown>).APM_MODULES_DIR)
      : "apm_modules";
  return join(cwd, name);
}

export function hasModulesContent(cwd: string): boolean {
  const dir = modulesDir(cwd);
  if (!existsSync(dir)) return false;
  return readdirSync(dir).length > 0;
}

export function listModulesFiles(cwd: string): string[] {
  const dir = modulesDir(cwd);
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string, prefix = "") => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(p).isDirectory()) walk(p, rel);
      else out.push(rel);
    }
  };
  walk(dir);
  return out.sort();
}

export function readLockText(cwd: string): string {
  const bapm = join(cwd, "bapm.lock.yaml");
  const apm = join(cwd, "apm.lock.yaml");
  if (existsSync(bapm)) return readFileSync(bapm, "utf8");
  if (existsSync(apm)) return readFileSync(apm, "utf8");
  throw new Error("expected lockfile after resolve/install");
}

export function lockOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result === "undefined") {
    throw new TypeError("expected lock/result object");
  }
  if (typeof result === "object") {
    const r = result as Record<string, unknown>;
    const doc = (r.document ?? r.lockfile ?? r.lock ?? r) as Record<string, unknown>;
    if (doc && typeof doc === "object") return doc;
  }
  throw new TypeError("expected document/lockfile object");
}

export function depsOf(doc: Record<string, unknown>): Record<string, unknown>[] {
  const deps = doc.dependencies;
  if (!Array.isArray(deps)) throw new TypeError("expected dependencies array");
  return deps as Record<string, unknown>[];
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

/** Enable experimental registries gate for the duration of fn. */
export async function withExperimentalRegistries<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.BAPM_EXPERIMENTAL_REGISTRIES;
  process.env.BAPM_EXPERIMENTAL_REGISTRIES = "1";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.BAPM_EXPERIMENTAL_REGISTRIES;
    else process.env.BAPM_EXPERIMENTAL_REGISTRIES = prev;
  }
}

/**
 * Valid registries block: named entry + `default: <name>` pointer (not `default: { url }`).
 * Per-dep `registry: <name>` is APM companion meta to `id` (apply may need parse allowlist).
 */
export function registryManifest(options: {
  name?: string;
  registryUrl: string;
  depId: string;
  depVersion?: string;
  /** Named registry key; when set with useDefault false, dep pins `registry: <name>`. */
  registryName?: string;
  useDefault?: boolean;
}): string {
  const name = options.name ?? "reg-root";
  const regName = options.registryName ?? "primary";
  const versionConstraint = options.depVersion ?? "^1.0.0";
  const pinNamed = options.useDefault === false;
  const depRegistryLine = pinNamed ? `\n      registry: ${regName}` : "";
  return `name: ${name}
version: 0.0.1
registries:
  ${regName}:
    url: ${options.registryUrl}
  default: ${regName}
dependencies:
  apm:
    - id: ${options.depId}
      version: "${versionConstraint}"${depRegistryLine}
`;
}

/** Invoke list/download/publish on a flexible client shape. */
export async function clientListVersions(
  client: unknown,
  owner: string,
  repo: string,
): Promise<unknown> {
  const c = client as Record<string, unknown>;
  for (const name of ["listVersions", "listPackageVersions", "list"] as const) {
    const fn = c[name];
    if (typeof fn === "function") {
      return await (fn as (a: string, b: string) => Promise<unknown>).call(client, owner, repo);
    }
  }
  throw new TypeError("registry client missing listVersions");
}

export async function clientDownload(
  client: unknown,
  owner: string,
  repo: string,
  version: string,
): Promise<Uint8Array> {
  const c = client as Record<string, unknown>;
  for (const name of ["download", "downloadVersion", "downloadArchive"] as const) {
    const fn = c[name];
    if (typeof fn === "function") {
      const result = await (fn as (a: string, b: string, v: string) => Promise<unknown>).call(
        client,
        owner,
        repo,
        version,
      );
      if (result instanceof Uint8Array) return result;
      if (Buffer.isBuffer(result)) return new Uint8Array(result);
      if (result && typeof result === "object") {
        const r = result as Record<string, unknown>;
        if (r.bytes instanceof Uint8Array) return r.bytes;
        if (Buffer.isBuffer(r.bytes)) return new Uint8Array(r.bytes);
        if (r.body instanceof Uint8Array) return r.body;
      }
      throw new TypeError("download did not return archive bytes");
    }
  }
  throw new TypeError("registry client missing download");
}

export async function clientPublish(
  client: unknown,
  owner: string,
  repo: string,
  version: string,
  bytes: Uint8Array,
): Promise<unknown> {
  const c = client as Record<string, unknown>;
  for (const name of ["publish", "publishVersion", "putVersion"] as const) {
    const fn = c[name];
    if (typeof fn === "function") {
      return await (
        fn as (a: string, b: string, v: string, body: Uint8Array) => Promise<unknown>
      ).call(client, owner, repo, version, bytes);
    }
  }
  throw new TypeError("registry client missing publish");
}
