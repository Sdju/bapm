/**
 * p3-openapm-mode-b-conformance helpers — repo paths + Mode B fixture/checklist loaders.
 * DoD paths from openspec/changes/p3-openapm-mode-b-conformance (fixtures, checklist, statement).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../../..");
export const repoRoot = resolve(coreRoot, "../..");

/** Vendored OpenAPM §12.4 seed tree (must not depend on `.samples/`). */
export const fixtureRoot = join(repoRoot, "tests/fixtures/spec-conformance");

/** Informative requirements mirror + Mode B checklist live under this dir. */
export const specConformanceDir = join(repoRoot, "tests/spec-conformance");

export const requirementsMirrorPath = join(
  specConformanceDir,
  "openapm-v0.1.requirements.yml",
);

/** Machine checklist: status active | skipped | n/a per req-XXX. */
export const checklistCandidates = [
  join(specConformanceDir, "checklist.yml"),
  join(specConformanceDir, "checklist.yaml"),
  join(specConformanceDir, "checklist.json"),
  join(specConformanceDir, "mode-b-checklist.yml"),
  join(specConformanceDir, "mode-b-checklist.yaml"),
  join(specConformanceDir, "mode-b-checklist.json"),
] as const;

export const conformanceMdPath = join(repoRoot, "CONFORMANCE.md");
export const conformanceJsonPath = join(repoRoot, "CONFORMANCE.json");

/** Generator / drift scripts expected by design. */
export const driftScriptCandidates = [
  join(repoRoot, "scripts/gen-conformance-statement.mjs"),
  join(repoRoot, "scripts/gen-conformance-statement.ts"),
  join(repoRoot, "scripts/gen-conformance-statement.js"),
  join(repoRoot, "scripts/check-conformance-drift.mjs"),
  join(repoRoot, "scripts/check-conformance-drift.ts"),
  join(repoRoot, "scripts/check-conformance-drift.js"),
  join(specConformanceDir, "gen-statement.mjs"),
  join(specConformanceDir, "gen-statement.ts"),
] as const;

export const REQUIRED_FIXTURE_RELATIVE = [
  "README.md",
  "manifest/valid-minimal.yml",
  "manifest/x-extension-roundtrip.yml",
  "lockfile/round-trip-unknown-fields.yml",
  "lockfile/v2-with-registry.yml",
  "lockfile/v1-git-only.yml",
  "policy/security-integrity.yml",
  "resolution/semver-dialect.json",
] as const;

export const CF001_MANIFEST_FIXTURES = [
  "manifest/valid-minimal.yml",
  "manifest/x-extension-roundtrip.yml",
] as const;

export const CF001_LOCKFILE_FIXTURES = [
  "lockfile/round-trip-unknown-fields.yml",
  "lockfile/v2-with-registry.yml",
] as const;

export function fixturePath(...parts: string[]): string {
  return join(fixtureRoot, ...parts);
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function loadYamlFile(path: string): unknown {
  return parseYaml(readText(path));
}

export function loadJsonFile(path: string): unknown {
  return JSON.parse(readText(path)) as unknown;
}

export function findExistingPath(candidates: readonly string[]): string | undefined {
  return candidates.find((p) => existsSync(p));
}

export function assertPathExists(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`expected ${label} at ${path}`);
  }
}

export function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listFilesRecursive(full).map((r) => join(name, r)));
    } else {
      out.push(name);
    }
  }
  return out;
}

export type ChecklistRow = {
  id: string;
  status: string;
  class?: string;
  fixture?: string | string[];
  assertion?: string;
  citation?: string;
  rationale?: string;
  waiver?: string;
  [key: string]: unknown;
};

/**
 * Normalize checklist document shapes:
 * - `{ requirements: [...] }`
 * - `{ checklist: [...] }`
 * - bare array
 */
export function checklistRows(doc: unknown): ChecklistRow[] {
  if (Array.isArray(doc)) return doc.map(normalizeRow);
  if (doc !== null && typeof doc === "object") {
    const o = doc as Record<string, unknown>;
    const list = o.requirements ?? o.checklist ?? o.rows ?? o.items;
    if (Array.isArray(list)) return list.map(normalizeRow);
  }
  throw new TypeError("checklist must be an array or { requirements|checklist|rows|items }");
}

function normalizeRow(raw: unknown): ChecklistRow {
  if (raw === null || typeof raw !== "object") {
    throw new TypeError("checklist row must be an object");
  }
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.req ?? r.req_id ?? "");
  const status = String(r.status ?? "").toLowerCase();
  return {
    ...r,
    id,
    status,
    class: r.class != null ? String(r.class) : r.conformance_class != null ? String(r.conformance_class) : undefined,
    fixture: (r.fixture ?? r.fixtures ?? r.fixture_path ?? r.fixture_paths) as
      | string
      | string[]
      | undefined,
    assertion: r.assertion != null ? String(r.assertion) : r.test != null ? String(r.test) : undefined,
    citation:
      r.citation != null
        ? String(r.citation)
        : r.test_citation != null
          ? String(r.test_citation)
          : undefined,
    rationale:
      r.rationale != null
        ? String(r.rationale)
        : r.waiver_rationale != null
          ? String(r.waiver_rationale)
          : undefined,
    waiver: r.waiver != null ? String(r.waiver) : undefined,
  };
}

export function normalizeTrailingNewline(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
}

export function documentOfParse(result: unknown): Record<string, unknown> {
  if (result === null || typeof result === "undefined") {
    throw new TypeError("expected parse result");
  }
  if (typeof result !== "object") {
    throw new TypeError("expected parse result object");
  }
  const r = result as Record<string, unknown>;
  if (r.document !== null && typeof r.document === "object") {
    return r.document as Record<string, unknown>;
  }
  return r as Record<string, unknown>;
}

export function readPackageJsonScripts(pkgPath: string): Record<string, string> {
  const raw = loadJsonFile(pkgPath) as { scripts?: Record<string, string> };
  return raw.scripts ?? {};
}

export function scriptsMentionConformance(scripts: Record<string, string>): boolean {
  return Object.entries(scripts).some(([name, cmd]) => {
    const blob = `${name} ${cmd}`.toLowerCase();
    return (
      blob.includes("conformance") ||
      blob.includes("gen-conformance") ||
      blob.includes("check-conformance") ||
      blob.includes("conformance:check") ||
      blob.includes("check:conformance")
    );
  });
}
