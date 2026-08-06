/**
 * Acceptance helpers for sc-host-class (OpenAPM §10.3 credential host-class).
 * Soft-resolve Auth / Registry / Manifest APIs from @bapm/core — missing exports = RED.
 */
import * as core from "@bapm/core";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
export const suiteDir = here;
export const coreRoot = resolve(here, "../../..");
export const repoRoot = resolve(coreRoot, "../..");

export const checklistPath = join(repoRoot, "tests/spec-conformance/checklist.yml");
export const conformanceMdPath = join(repoRoot, "CONFORMANCE.md");
export const conformanceJsonPath = join(repoRoot, "CONFORMANCE.json");

/** Claim IDs this change must activate (sc-004 stays skipped). */
export const CLAIM_ACTIVE_IDS = [
  "req-sc-003",
  "req-sc-005",
  "req-sc-008",
  "req-sc-013",
] as const;

export const KEEP_SKIPPED_IDS = ["req-sc-004"] as const;

export const PRIOR_ACTIVE_SC_IDS = [
  "req-sc-001",
  "req-sc-002",
  "req-sc-006",
  "req-sc-007",
  "req-sc-009",
  "req-sc-010",
  "req-sc-011",
  "req-sc-012",
] as const;

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

/** PSL eTLD+1 credential host-class classifier (sc-005). */
export function getCredentialHostClassOf(): (hostname: string) => string {
  return pickExport(
    [
      "credentialHostClassOf",
      "credentialHostClass",
      "authHostClassOf",
      "hostClassForCredentials",
    ],
    "credential host-class classifier",
  ) as (hostname: string) => string;
}

/** Whether two hosts share a credential class given optional registry alias map. */
export function getSameCredentialHostClass(): (
  a: string,
  b: string,
  options?: Record<string, unknown>,
) => boolean {
  return pickExport(
    [
      "sameCredentialHostClass",
      "credentialHostClassesEqual",
      "hostsShareCredentialClass",
    ],
    "credential host-class equality",
  ) as (a: string, b: string, options?: Record<string, unknown>) => boolean;
}

/** Shared resolve — never forwards class A creds to class B (sc-003). */
export function getResolveCredentialsForHost(): (
  options: Record<string, unknown>,
) => unknown {
  return pickExport(
    [
      "resolveCredentialsForHost",
      "resolveAuthCredentialsForHost",
      "resolveHostCredentials",
    ],
    "resolve credentials per host class",
  ) as (options: Record<string, unknown>) => unknown;
}

/** Redirect-safe Authed fetch helper (sc-003). */
export function getFetchWithRedirectAuthDrop(): (
  input: string | URL | Request,
  init?: Record<string, unknown>,
) => Promise<Response> {
  return pickExport(
    [
      "fetchWithRedirectAuthDrop",
      "fetchRedirectAuthDrop",
      "redirectSafeFetch",
      "fetchWithCredentialHostClassRedirects",
    ],
    "redirect Auth drop fetch",
  ) as (input: string | URL | Request, init?: Record<string, unknown>) => Promise<Response>;
}

export function getCreateFetchTransport(): () => {
  fetch: (request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: Uint8Array;
  }) => Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>;
} {
  return pickExport(
    ["createFetchTransport"],
    "Registry createFetchTransport",
  ) as () => {
    fetch: (request: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: Uint8Array;
    }) => Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>;
  };
}

/** Git child env: ambient suppress + selected-class attach + sc-008 refuse. */
export function getBuildGitChildEnv(): (options: Record<string, unknown>) => NodeJS.ProcessEnv {
  return pickExport(
    [
      "buildGitChildEnv",
      "buildHardenedGitEnv",
      "createGitChildEnv",
      "gitChildEnvForHost",
    ],
    "git ambient-suppress child env",
  ) as (options: Record<string, unknown>) => NodeJS.ProcessEnv;
}

/** Operator / provider class selection with overlap precedence (sc-013). */
export function getSelectProviderClassForHost(): (
  host: string,
  env?: NodeJS.ProcessEnv,
) => string {
  return pickExport(
    [
      "selectProviderClassForHost",
      "effectiveProviderClassForHost",
      "classifyProviderHostClass",
      "classifyMarketplaceHost",
    ],
    "provider class overlap selection",
  ) as (host: string, env?: NodeJS.ProcessEnv) => string;
}

export function getParseManifest(): (input: unknown) => unknown {
  return pickExport(
    ["parseManifest", "parseApmManifest", "loadManifestDocument"],
    "manifest parse",
  ) as (input: unknown) => unknown;
}

export function getHostClassOf(): (input: unknown) => unknown {
  return pickExport(
    ["hostClassOf", "policyHostClass", "hostClassForPolicy", "resolveHostClass"],
    "policy/credential hostClassOf",
  ) as (input: unknown) => unknown;
}

export function tokenPayload(resolved: unknown): {
  token?: string;
  source?: string;
  attached?: boolean;
} {
  if (resolved == null) return {};
  if (typeof resolved === "string") return { token: resolved };
  if (typeof resolved !== "object") return {};
  const o = resolved as Record<string, unknown>;
  const token =
    (typeof o.token === "string" && o.token) ||
    (typeof o.value === "string" && o.value) ||
    (typeof o.pat === "string" && o.pat) ||
    undefined;
  const source =
    (typeof o.source === "string" && o.source) ||
    (typeof o.sourceId === "string" && o.sourceId) ||
    (typeof o.env === "string" && o.env) ||
    undefined;
  const attached = typeof o.attached === "boolean" ? o.attached : undefined;
  return { token, source, attached };
}

export function hasUsableToken(resolved: unknown): boolean {
  const { token } = tokenPayload(resolved);
  return Boolean(token && token.length > 0);
}

/** Snapshot + restore selected env keys. */
export async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const next = patch[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(patch)) {
      const v = prev[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
    }
  }
}

export type ChecklistRow = {
  id: string;
  status?: string;
  citation?: string;
  rationale?: string;
  [key: string]: unknown;
};

export type ChecklistDoc = {
  limitations?: string[];
  scope_out?: string[];
  requirements?: ChecklistRow[];
  [key: string]: unknown;
};

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function loadChecklist(): ChecklistDoc {
  return parseYaml(readText(checklistPath)) as ChecklistDoc;
}

export function checklistRows(doc: ChecklistDoc = loadChecklist()): ChecklistRow[] {
  return Array.isArray(doc.requirements) ? doc.requirements : [];
}

export function byId(rows: ChecklistRow[], id: string): ChecklistRow {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`checklist missing ${id}`);
  return row;
}

export function citationPaths(citation: string | undefined): string[] {
  if (!citation) return [];
  return citation
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^CONFORMANCE\.(md|json)$/i.test(p));
}

export function pathExistsInRepo(rel: string): boolean {
  return existsSync(join(repoRoot, rel));
}

export function limitationsBlob(doc: ChecklistDoc): string {
  return (doc.limitations ?? []).join("\n");
}

export function scopeOutBlob(doc: ChecklistDoc): string {
  return (doc.scope_out ?? []).join("\n");
}

/** Citation path must live under this change's acceptance (or promoted) tree. */
export function citationMentionsScHostClass(citation: string | undefined): boolean {
  if (!citation) return false;
  return /sc-host-class/i.test(citation);
}

export { core, join };
