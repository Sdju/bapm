/**
 * Pack / release-gate / archive round-trip test helpers — pickExport for public APIs.
 */
import { asText } from "../asText.ts";
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");
export const repoRoot = resolve(coreRoot, "../..");

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-core-pack-"): TempProject {
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

export function writeConformingManifest(
  cwd: string,
  options?: { name?: string; version?: string; filename?: "bapm.yml" | "apm.yml" },
): string {
  const name = options?.name ?? "demo-pkg";
  const version = options?.version ?? "1.2.3";
  const filename = options?.filename ?? "bapm.yml";
  const path = join(cwd, filename);
  writeFileSync(
    path,
    `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`,
    "utf8",
  );
  return path;
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

/** Minimal scaffold for init / producer emit (mf-001..003). */
export function getCreateMinimalManifest(): (options: Record<string, unknown>) => unknown {
  return pickExport(["createMinimalManifest", "createMinimalManifestDocument"], "M7 init emit") as (
    options: Record<string, unknown>,
  ) => unknown;
}

/** Producer write that MUST validate before durable emit. */
export function getProducerWrite(): (
  document: Record<string, unknown>,
  options?: Record<string, unknown>,
) => unknown {
  return pickExport(
    ["writeProducerManifest", "emitManifest", "writeManifestValidated", "writeManifest"],
    "M7 producer write",
  ) as (document: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
}

export function getSerializeManifest(): (document: Record<string, unknown>) => string {
  return pickExport(["serializeManifest"], "M7 serialize") as (
    document: Record<string, unknown>,
  ) => string;
}

export function getParseManifest(): (input: unknown) => Record<string, unknown> {
  return pickExport(["parseManifest"], "M7 parse") as (input: unknown) => Record<string, unknown>;
}

export function getLoadManifest(): (options: Record<string, unknown>) => unknown {
  return pickExport(["loadManifest"], "M7 load") as (options: Record<string, unknown>) => unknown;
}

/** Plain-zip pack (MUST path `--archive`). */
export function getRunPack(): (options: Record<string, unknown>) => unknown {
  return pickExport(["runPack", "packProject", "packArchive"], "M7 pack") as (
    options: Record<string, unknown>,
  ) => unknown;
}

/** Extract helper for install-from-archive round-trip. */
export function getExtractPackArchive(): (options: Record<string, unknown>) => unknown {
  return pickExport(["extractPackArchive", "unpackArchive", "extractPack"], "M7 extract") as (
    options: Record<string, unknown>,
  ) => unknown;
}

/** pr-004 tag↔version gate. */
export function getCheckReleaseTag(): (options: Record<string, unknown>) => unknown {
  return pickExport(["checkReleaseTag", "checkRelease", "runCheckRelease"], "M7 pr-004") as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function documentOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected document-like object");
  }
  const r = result as Record<string, unknown>;
  const doc = (r.document ?? r.manifest ?? r) as Record<string, unknown>;
  if (doc === null || typeof doc !== "object") {
    throw new TypeError("expected document/manifest object");
  }
  return doc;
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
    /is not a function|expected @bapm\/core to export/i.test(thrown.message)
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

export async function expectRejectsMatching(fn: () => unknown, pattern: RegExp): Promise<unknown> {
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
    /is not a function|expected @bapm\/core to export/i.test(thrown.message)
  ) {
    throw thrown;
  }
  const message =
    thrown instanceof Error
      ? thrown.message
      : typeof thrown === "object" && thrown !== null && "message" in thrown
        ? asText((thrown as { message: unknown }).message)
        : asText(thrown);
  const haystack = `${message}`;
  if (!pattern.test(haystack)) {
    throw new Error(`expected error matching ${pattern}, got: ${haystack}`);
  }
  return thrown;
}

/** Resolve archive path from pack result bag or common default names under cwd. */
export function resolvePackArtifact(cwd: string, result?: unknown): string | undefined {
  if (result !== null && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["archivePath", "outputPath", "path", "artifactPath", "zipPath"] as const) {
      const v = r[key];
      if (typeof v === "string" && existsSync(v)) return v;
    }
  }
  const candidates = [
    join(cwd, "demo-pkg-1.2.3.zip"),
    join(cwd, "package.zip"),
    join(cwd, "dist.zip"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Any .zip written under cwd (shallow)
  if (existsSync(cwd)) {
    for (const name of readdirSync(cwd)) {
      if (name.endsWith(".zip")) {
        const p = join(cwd, name);
        if (statSync(p).isFile()) return p;
      }
    }
  }
  return undefined;
}

export { core };
