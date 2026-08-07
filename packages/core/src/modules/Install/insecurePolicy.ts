/**
 * HTTP insecure dependency policy (APM `insecure_policy` intent).
 * Dual-consent for direct http:// deps; host allowlist for transitive.
 */
import type { BapmManifest, DependencyEntry, ObjectDependency } from "@/modules/Manifest";
import { loadManifest } from "@/modules/Manifest";
import { isAbsolute, resolve as resolvePath } from "node:path";
import { existsSync } from "node:fs";
import { InstallError } from "./errors.ts";

export type InsecureDependencyInfo = {
  url: string;
  isTransitive: boolean;
  introducedBy?: string;
  /** Manifest entry has `allow_insecure: true` (directs only meaningful). */
  allowInsecure?: boolean;
};

const FQDN_RE =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

export function isValidFqdn(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.split("/")[0]!;
  return FQDN_RE.test(host);
}

export function isHttpInsecureUrl(url: string): boolean {
  return /^http:\/\//i.test(url.trim());
}

export function extractHostname(url: string): string | undefined {
  try {
    const host = new URL(url).hostname;
    return host ? host.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeAllowInsecureHost(hostname: string): string {
  const cleaned = String(hostname).trim().toLowerCase();
  if (!isValidFqdn(cleaned)) {
    throw new InstallError(
      "INSTALL_INVALID_HOST",
      `Invalid hostname '${hostname}'. Use a bare hostname like 'mirror.example.com'.`,
      { details: { hostname } },
    );
  }
  return cleaned;
}

export function normalizeAllowInsecureHosts(hosts: string[] | undefined): string[] {
  if (!hosts || hosts.length === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of hosts) {
    const n = normalizeAllowInsecureHost(raw);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function formatInsecureDependencyRequirements(
  url: string,
  options: { missingDepAllow?: boolean; missingCliFlag?: boolean } = {},
): string {
  const missingDepAllow = options.missingDepAllow !== false;
  const missingCliFlag = options.missingCliFlag !== false;
  const lines = [`${url} -- HTTP dependency (unencrypted)`, "To install:"];
  let step = 1;
  if (missingDepAllow) {
    lines.push(`  ${step}. Set allow_insecure: true on the dep in apm.yml`);
    step += 1;
  }
  if (missingCliFlag) {
    lines.push(`  ${step}. Pass --allow-insecure to apm install`);
  }
  return lines.join("\n");
}

export function formatInsecureDependencyWarning(info: InsecureDependencyInfo): string {
  let message = `Insecure HTTP fetch (unencrypted): ${info.url}`;
  if (info.isTransitive && info.introducedBy) {
    message = `${message} (transitive, introduced by ${info.introducedBy})`;
  }
  return message;
}

function entryGitUrl(entry: DependencyEntry): string | undefined {
  if (typeof entry === "string") {
    const t = entry.trim();
    if (/^https?:\/\//i.test(t) || t.startsWith("git@")) return t.split("#")[0];
    return undefined;
  }
  if (entry && typeof entry === "object" && typeof (entry as ObjectDependency).git === "string") {
    return String((entry as ObjectDependency).git);
  }
  return undefined;
}

function entryAllowInsecure(entry: DependencyEntry): boolean {
  if (!entry || typeof entry !== "object") return false;
  return (entry as ObjectDependency).allow_insecure === true;
}

function entryPath(entry: DependencyEntry): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const p = (entry as ObjectDependency).path;
  return typeof p === "string" ? p : undefined;
}

function listApm(deps: { apm?: DependencyEntry[] } | undefined): DependencyEntry[] {
  return Array.isArray(deps?.apm) ? deps!.apm! : [];
}

/**
 * Walk root + local path trees to collect HTTP insecure dependency infos
 * without downloading remote packages.
 */
export function collectInsecureDependencyInfos(
  cwd: string,
  document: BapmManifest,
): InsecureDependencyInfo[] {
  const infos: InsecureDependencyInfo[] = [];
  const rootName = String(document.name ?? "root");
  const rootEntries = [...listApm(document.dependencies), ...listApm(document.devDependencies)];

  for (const entry of rootEntries) {
    collectFromEntry(entry, {
      cwd,
      fromDir: cwd,
      isTransitive: false,
      introducedBy: undefined,
      parentName: rootName,
      infos,
      seenLocal: new Set(),
    });
  }
  return infos;
}

function collectFromEntry(
  entry: DependencyEntry,
  ctx: {
    cwd: string;
    fromDir: string;
    isTransitive: boolean;
    introducedBy: string | undefined;
    parentName: string;
    infos: InsecureDependencyInfo[];
    seenLocal: Set<string>;
  },
): void {
  const git = entryGitUrl(entry);
  if (git && isHttpInsecureUrl(git)) {
    const ref =
      typeof entry === "object" && entry && typeof (entry as ObjectDependency).ref === "string"
        ? String((entry as ObjectDependency).ref)
        : undefined;
    const url = ref ? `${git}#${ref}` : git;
    ctx.infos.push({
      url,
      isTransitive: ctx.isTransitive,
      introducedBy: ctx.isTransitive ? ctx.introducedBy : undefined,
      allowInsecure: entryAllowInsecure(entry),
    });
  }

  const rel = entryPath(entry);
  if (!rel) return;
  const abs = isAbsolute(rel) ? rel : resolvePath(ctx.fromDir, rel);
  if (!existsSync(abs) || ctx.seenLocal.has(abs)) return;
  ctx.seenLocal.add(abs);

  let childDoc: BapmManifest;
  try {
    childDoc = loadManifest({ cwd: abs }).document;
  } catch {
    return;
  }
  const childName = String(childDoc.name ?? rel);
  for (const child of listApm(childDoc.dependencies)) {
    collectFromEntry(child, {
      ...ctx,
      fromDir: abs,
      isTransitive: true,
      introducedBy: childName,
      parentName: childName,
    });
  }
}

export function enforceInsecurePolicy(args: {
  infos: InsecureDependencyInfo[];
  allowInsecure: boolean;
  allowInsecureHosts: string[];
}): { warnings: string[] } {
  const { infos, allowInsecure } = args;
  const allowInsecureHosts = args.allowInsecureHosts;

  // Direct dual-consent
  for (const info of infos) {
    if (info.isTransitive) continue;
    if (!isHttpInsecureUrl(info.url.split("#")[0]!)) continue;
    const depAllow = info.allowInsecure === true;
    if (!depAllow) {
      const message = formatInsecureDependencyRequirements(info.url, {
        missingDepAllow: true,
        missingCliFlag: !allowInsecure,
      });
      throw new InstallError("INSTALL_INSECURE", message, {
        details: { url: info.url, missingDepAllow: true, missingCliFlag: !allowInsecure },
      });
    }
    if (!allowInsecure) {
      const message = formatInsecureDependencyRequirements(info.url, {
        missingDepAllow: false,
        missingCliFlag: true,
      });
      throw new InstallError("INSTALL_INSECURE", message, {
        details: { url: info.url, missingDepAllow: false, missingCliFlag: true },
      });
    }
  }

  // Transitive host allowlist
  const allowedHosts = new Set(allowInsecureHosts);
  if (allowInsecure) {
    for (const info of infos) {
      if (info.isTransitive) continue;
      const host = extractHostname(info.url);
      if (host) allowedHosts.add(host);
    }
  }

  const transitive = infos.filter((i) => i.isTransitive);
  if (transitive.length > 0) {
    const blockedHosts = [
      ...new Set(
        transitive
          .map((i) => extractHostname(i.url))
          .filter((h): h is string => Boolean(h) && !allowedHosts.has(h!)),
      ),
    ].sort();
    if (blockedHosts.length > 0) {
      const suggestedFlags = blockedHosts.map((h) => `--allow-insecure-host ${h}`).join(" ");
      const message =
        `Re-run with ${suggestedFlags} to allow transitive HTTP dependencies ` +
        `from unapproved host(s): ${blockedHosts.join(", ")}.`;
      throw new InstallError("INSTALL_INSECURE", message, {
        details: { blockedHosts },
      });
    }
  }

  const warnings = infos.map((info) => formatInsecureDependencyWarning(info));
  return { warnings };
}

/** Gate before download/materialize; returns warning messages for allowed insecure deps. */
export function gateInsecureBeforeFetch(args: {
  cwd: string;
  document: BapmManifest;
  allowInsecure?: boolean;
  allowInsecureHosts?: string[];
}): { warnings: string[]; allowInsecureHosts: string[] } {
  const hosts = normalizeAllowInsecureHosts(args.allowInsecureHosts);
  const infos = collectInsecureDependencyInfos(args.cwd, args.document);
  const { warnings } = enforceInsecurePolicy({
    infos,
    allowInsecure: args.allowInsecure === true,
    allowInsecureHosts: hosts,
  });
  return { warnings, allowInsecureHosts: hosts };
}
