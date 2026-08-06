import {
  addMarketplace,
  autoDetectMarketplacePath,
  clearMarketplaceCache,
  createMarketplaceSource,
  fetchMarketplace,
  getMarketplace,
  listMarketplaces,
  MarketplaceFetchError,
  MarketplaceNotFoundError,
  removeMarketplace,
  urlNamesRemoteManifest,
  validateMarketplace,
  type MarketplaceSource,
} from "@bapm/core";
import { existsSync, statSync } from "node:fs";
import { basename, resolve as pathResolve } from "node:path";
import { createInterface } from "node:readline";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

const ALIAS_RE = /^[a-zA-Z0-9._-]+$/;
const SUPPORTED_SUBCOMMANDS = new Set(["add", "list", "browse", "update", "remove", "validate"]);

export type MarketplaceCliDeps = LifecycleCliDeps;

export type MarketplaceOptions = { args?: string[]; cwd?: string };

function looksLikeLocal(raw: string): boolean {
  if (!raw) return false;
  if (raw.toLowerCase().startsWith("file://")) return true;
  if (
    raw.startsWith("/") ||
    raw.startsWith("./") ||
    raw.startsWith("../") ||
    raw.startsWith("~/") ||
    raw === "~"
  ) {
    return true;
  }
  return (
    raw.length >= 3 &&
    /[a-zA-Z]/.test(raw[0]!) &&
    raw[1] === ":" &&
    (raw[2] === "\\" || raw[2] === "/")
  );
}

function splitFragmentRef(source: string): { sourceArg: string; fragmentRef: string | null } {
  const hash = source.lastIndexOf("#");
  if (hash <= 0) return { sourceArg: source, fragmentRef: null };
  // Only treat as fragment for URL-like sources
  const before = source.slice(0, hash);
  if (!before.includes("://") && !before.startsWith("git@")) {
    return { sourceArg: source, fragmentRef: null };
  }
  return { sourceArg: before, fragmentRef: source.slice(hash + 1) || null };
}

function defaultAliasFromUrl(url: string): string {
  try {
    if (urlNamesRemoteManifest(url) || url.toLowerCase().endsWith("/marketplace.json")) {
      const host = new URL(url).hostname.replace(/\./g, "-");
      return sanitizeAlias(host || "marketplace");
    }
    const path = new URL(url).pathname.replace(/\.git$/, "");
    const segs = path.split("/").filter(Boolean);
    return sanitizeAlias(segs.at(-1) || "marketplace");
  } catch {
    return sanitizeAlias(basename(url.replace(/\/$/, "")) || "marketplace");
  }
}

function sanitizeAlias(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "marketplace";
}

function isValidAlias(name: string): boolean {
  return ALIAS_RE.test(name);
}

type ParsedSource = {
  url: string;
  kindHint: string;
  host: string | null;
  isDirectUrl: boolean;
  isLocal: boolean;
};

function parseMarketplaceSource(source: string, hostFlag: string | null): ParsedSource {
  const raw = (source || "").trim();
  if (!raw) throw new Error("Empty source argument");
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) < 32) {
      throw new Error("Source argument contains invalid control characters");
    }
  }

  if (looksLikeLocal(raw)) {
    const abs = raw.toLowerCase().startsWith("file://")
      ? raw
      : pathResolve(raw.startsWith("~") ? raw.replace(/^~/, process.env.HOME ?? "") : raw);
    return {
      url: abs.toLowerCase().startsWith("file://") ? abs : abs,
      kindHint: "local",
      host: null,
      isDirectUrl: false,
      isLocal: true,
    };
  }

  const lowered = raw.toLowerCase();
  if (lowered.startsWith("http://")) {
    throw new Error(
      `Insecure HTTP URL rejected: '${raw}'. Use HTTPS for marketplace registration.`,
    );
  }

  if (lowered.startsWith("https://")) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(`Invalid HTTPS URL: '${raw}'`);
    }
    const embeddedHost = (parsed.hostname || "").toLowerCase();
    if (!embeddedHost) throw new Error(`HTTPS URL is missing a host: '${raw}'`);
    const pathSegments = decodeURIComponent(parsed.pathname || "")
      .split("/")
      .filter(Boolean);
    for (const seg of pathSegments) {
      if (seg === ".." || seg === ".") {
        throw new Error(`Invalid source '${raw}': contains a path-traversal sequence.`);
      }
    }
    if (!pathSegments.length) {
      throw new Error(`HTTPS URL is missing a repo path: '${raw}'`);
    }
    if (hostFlag && hostFlag.trim().toLowerCase() !== embeddedHost) {
      throw new Error(
        `Conflicting host: --host '${hostFlag}' does not match '${embeddedHost}' in '${raw}'.`,
      );
    }
    const isDirect =
      urlNamesRemoteManifest(raw) ||
      parsed.pathname.replace(/\/$/, "").endsWith("/marketplace.json");
    let kindHint = "git";
    if (isDirect) kindHint = "url";
    else if (embeddedHost === "github.com" || embeddedHost.endsWith(".ghe.com"))
      kindHint = "github";
    else if (embeddedHost === "gitlab.com" || embeddedHost.endsWith(".gitlab.com")) {
      kindHint = "gitlab";
    } else if (embeddedHost === "dev.azure.com" || embeddedHost.endsWith(".visualstudio.com")) {
      kindHint = "ado";
    }
    if ((kindHint === "github" || kindHint === "gitlab") && pathSegments.length < 2) {
      throw new Error(`Invalid format: '${raw}'. Expected 'OWNER/REPO' in the URL path.`);
    }
    return {
      url: raw,
      kindHint,
      host: embeddedHost,
      isDirectUrl: isDirect,
      isLocal: false,
    };
  }

  // OWNER/REPO shorthand
  const segments = decodeURIComponent(raw).split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error(
      `Invalid format: '${raw}'. Expected 'OWNER/REPO', a full HTTPS URL, or a local path.`,
    );
  }
  for (const seg of segments) {
    if (seg === ".." || seg === ".") {
      throw new Error(`Invalid source '${raw}': contains a path-traversal sequence.`);
    }
  }
  let embeddedHost: string | null = null;
  let ownerSegs = segments;
  if (segments[0]!.includes(".")) {
    if (segments.length < 3) {
      throw new Error(
        `Invalid format: '${raw}'. When the first segment is a host FQDN, at least 'HOST/OWNER/REPO' is required.`,
      );
    }
    embeddedHost = segments[0]!.toLowerCase();
    ownerSegs = segments.slice(1);
  }
  const repoName = ownerSegs.at(-1)!;
  const ownerPath = ownerSegs.slice(0, -1).join("/");
  const resolvedHost = (hostFlag || "").trim().toLowerCase() || embeddedHost || "github.com";
  if (hostFlag && embeddedHost && hostFlag.trim().toLowerCase() !== embeddedHost) {
    throw new Error(
      `Conflicting host: --host '${hostFlag}' does not match '${embeddedHost}' in '${raw}'.`,
    );
  }
  let kindHint = "git";
  if (resolvedHost === "github.com" || resolvedHost.endsWith(".ghe.com")) kindHint = "github";
  else if (resolvedHost === "gitlab.com" || resolvedHost.endsWith(".gitlab.com")) {
    kindHint = "gitlab";
  } else if (resolvedHost === "dev.azure.com" || resolvedHost.endsWith(".visualstudio.com")) {
    kindHint = "ado";
  }
  return {
    url: `https://${resolvedHost}/${ownerPath}/${repoName}`,
    kindHint,
    host: resolvedHost,
    isDirectUrl: false,
    isLocal: false,
  };
}

export function formatMarketplaceHelp(deps: MarketplaceCliDeps): string {
  return `${deps.name} marketplace — Register and browse consumer marketplaces

Usage:
  bapm marketplace <subcommand> [options]

Subcommands:
  add SOURCE       Register a marketplace (probe-fetch before persist)
  list             List registered marketplaces
  browse NAME      List plugins in a registered marketplace
  update [NAME]    Clear cache and refetch (all if NAME omitted)
  remove NAME      Remove a registered marketplace (-y required non-interactive)
  validate NAME    Thin schema + duplicate-name checks

Options (add):
  --name, -n <alias>   Display name (pattern [a-zA-Z0-9._-]+)
  --ref, -r <ref>      Git ref (default: main)
  --host <fqdn>        Host for OWNER/REPO shorthand (github.com only in v1)
  -h, --help           Show this help

Hosts beyond github/url/local and ref-checking are out of scope for this release.
`;
}

type ParsedArgs = {
  help?: boolean;
  error?: string;
  sub?: string;
  rest?: string[];
};

export function parseMarketplaceArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return { help: true };
  }
  const sub = argv[0]!;
  if (sub.startsWith("-")) {
    return { error: `Unknown marketplace flag: ${sub}` };
  }
  if (!SUPPORTED_SUBCOMMANDS.has(sub)) {
    return {
      error: `Unknown marketplace subcommand '${sub}' (invalid / unrecognized / not supported)`,
    };
  }
  return { sub, rest: argv.slice(1) };
}

async function promptConfirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(message, resolve);
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

function printValidation(results: ReturnType<typeof validateMarketplace>): boolean {
  let ok = true;
  for (const r of results) {
    if (!r.passed) {
      ok = false;
      for (const err of r.errors) console.error(`  ✗ ${r.checkName}: ${err}`);
    } else {
      console.log(`  ✓ ${r.checkName}`);
    }
  }
  return ok;
}

async function runAdd(
  deps: MarketplaceCliDeps,
  argv: string[],
  _cwd: string,
): Promise<LifecycleResult> {
  let name: string | undefined;
  let ref: string | undefined;
  let host: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      console.log(formatMarketplaceHelp(deps));
      return { ok: true, exitCode: 0 };
    }
    if (arg === "--name" || arg === "-n") {
      name = argv[++i];
      if (!name) return fail(deps, "Missing value for --name");
      continue;
    }
    if (arg === "--ref" || arg === "-r") {
      ref = argv[++i];
      if (!ref) return fail(deps, "Missing value for --ref");
      continue;
    }
    if (arg === "--host") {
      host = argv[++i];
      if (!host) return fail(deps, "Missing value for --host");
      continue;
    }
    if (arg.startsWith("-")) return fail(deps, `Unknown marketplace add flag: ${arg}`);
    positional.push(arg);
  }
  if (positional.length !== 1) {
    return fail(deps, "Usage: bapm marketplace add SOURCE [--name NAME] [--ref REF] [--host HOST]");
  }

  const { sourceArg, fragmentRef } = splitFragmentRef(positional[0]!);
  if (fragmentRef && ref) {
    return fail(deps, "Do not combine a git URL #ref with --ref. Use one ref source.");
  }
  const effectiveRef = fragmentRef || ref || "main";

  if (name !== undefined && !isValidAlias(name)) {
    return fail(
      deps,
      `Invalid marketplace name/alias: '${name}'. Names must match [a-zA-Z0-9._-]+`,
    );
  }

  let parsed: ParsedSource;
  try {
    parsed = parseMarketplaceSource(sourceArg, host ?? null);
  } catch (err) {
    return fail(deps, err instanceof Error ? err.message : String(err));
  }

  if (host && !parsed.isLocal && !parsed.isDirectUrl) {
    const h = host.trim().toLowerCase();
    if (h !== "github.com" && !h.endsWith(".ghe.com")) {
      // v1 only github.com for --host shorthand; also refuse non-github resolved hosts below
    }
  }

  if (parsed.kindHint === "gitlab" || parsed.kindHint === "ado" || parsed.kindHint === "git") {
    return fail(
      deps,
      `Unsupported marketplace host/kind '${parsed.kindHint}' ` +
        `(gitlab/ado/generic-git not supported in this release). Use github.com, HTTPS marketplace.json, or local.`,
    );
  }

  if (parsed.host && parsed.kindHint === "github") {
    const h = parsed.host.toLowerCase();
    if (h !== "github.com" && !h.endsWith(".ghe.com")) {
      return fail(deps, `Unsupported marketplace host '${parsed.host}' (only github.com in v1).`);
    }
  }

  const provisional =
    name ||
    (parsed.isDirectUrl || parsed.isLocal
      ? defaultAliasFromUrl(parsed.url)
      : defaultAliasFromUrl(parsed.url));

  let probePath = "";
  if (parsed.isDirectUrl) {
    probePath = "";
  } else if (parsed.isLocal) {
    const localFs = parsed.url.replace(/^file:\/\//, "");
    if (existsSync(localFs) && statSync(localFs).isFile()) {
      probePath = "";
    } else {
      probePath = "marketplace.json";
    }
  } else {
    probePath = "marketplace.json";
  }

  try {
    if (!parsed.isDirectUrl && !(parsed.isLocal && probePath === "")) {
      const root = parsed.isLocal ? parsed.url.replace(/^file:\/\//, "") : null;
      const isFile = root && existsSync(root) && statSync(root).isFile();
      if (!isFile) {
        const detected = await autoDetectMarketplacePath(
          createMarketplaceSource({
            name: provisional,
            url: parsed.url,
            ref: effectiveRef,
            path: "",
            host: parsed.host ?? undefined,
          }),
          { forceRefresh: true },
        );
        probePath = detected;
      }
    }

    const fetchSource = createMarketplaceSource({
      name: provisional,
      url: parsed.url,
      ref: parsed.isDirectUrl ? "" : effectiveRef,
      path: probePath,
      host: parsed.host ?? undefined,
    });
    const manifest = await fetchMarketplace(fetchSource, { forceRefresh: true });

    let displayName = provisional;
    if (name !== undefined) {
      displayName = name;
    } else if (manifest.name && isValidAlias(manifest.name.trim())) {
      displayName = manifest.name.trim();
    }

    if (!isValidAlias(displayName)) {
      return fail(deps, `Invalid marketplace name/alias: '${displayName}'`);
    }

    const finalSource = createMarketplaceSource({
      name: displayName,
      url: parsed.url,
      ref: parsed.isDirectUrl ? "" : effectiveRef,
      path: probePath,
      host: parsed.host ?? undefined,
    });
    addMarketplace(finalSource);
    console.log(`Registered marketplace '${displayName}' (${manifest.plugins.length} plugin(s)).`);
    return { ok: true, exitCode: 0 };
  } catch (err) {
    return fail(deps, err instanceof Error ? err.message : String(err));
  }
}

function fail(deps: MarketplaceCliDeps, message: string): LifecycleResult {
  console.error(`${deps.name}: ${message}`);
  return { ok: false, exitCode: 1, message };
}

async function runList(_deps: MarketplaceCliDeps): Promise<LifecycleResult> {
  const listed = listMarketplaces();
  if (listed.length === 0) {
    console.log("No marketplaces registered. Add one with: bapm marketplace add SOURCE");
    return { ok: true, exitCode: 0 };
  }
  for (const src of listed) {
    console.log(`${src.name}\t${src.displaySource}\t(${src.kind})`);
  }
  return { ok: true, exitCode: 0 };
}

async function runBrowse(deps: MarketplaceCliDeps, argv: string[]): Promise<LifecycleResult> {
  const name = argv.find((a) => !a.startsWith("-"));
  if (!name) return fail(deps, "Usage: bapm marketplace browse NAME");
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(formatMarketplaceHelp(deps));
      return { ok: true, exitCode: 0 };
    }
    if (arg.startsWith("-")) return fail(deps, `Unknown marketplace browse flag: ${arg}`);
  }
  try {
    const source = getMarketplace(name);
    const manifest = await fetchMarketplace(source, { forceRefresh: true });
    if (manifest.plugins.length === 0) {
      console.log(`No plugins in marketplace '${source.name}'.`);
    } else {
      for (const p of manifest.plugins) {
        const desc = p.description ? ` — ${p.description}` : "";
        console.log(`${p.name}${desc}`);
      }
    }
    return { ok: true, exitCode: 0 };
  } catch (err) {
    return fail(deps, err instanceof Error ? err.message : String(err));
  }
}

async function runUpdate(deps: MarketplaceCliDeps, argv: string[]): Promise<LifecycleResult> {
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(formatMarketplaceHelp(deps));
      return { ok: true, exitCode: 0 };
    }
    if (arg.startsWith("-")) return fail(deps, `Unknown marketplace update flag: ${arg}`);
  }
  const name = argv[0];
  try {
    const targets: MarketplaceSource[] = name ? [getMarketplace(name)] : listMarketplaces();
    if (targets.length === 0) {
      console.log("No marketplaces registered. Add one with: bapm marketplace add SOURCE");
      return { ok: true, exitCode: 0 };
    }
    for (const src of targets) {
      clearMarketplaceCache(src);
      await fetchMarketplace(src, { forceRefresh: true });
      console.log(`Updated marketplace '${src.name}'.`);
    }
    return { ok: true, exitCode: 0 };
  } catch (err) {
    return fail(deps, err instanceof Error ? err.message : String(err));
  }
}

async function runRemove(deps: MarketplaceCliDeps, argv: string[]): Promise<LifecycleResult> {
  let yes = false;
  const positional: string[] = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(formatMarketplaceHelp(deps));
      return { ok: true, exitCode: 0 };
    }
    if (arg === "-y" || arg === "--yes") {
      yes = true;
      continue;
    }
    if (arg.startsWith("-")) return fail(deps, `Unknown marketplace remove flag: ${arg}`);
    positional.push(arg);
  }
  const name = positional[0];
  if (!name) return fail(deps, "Usage: bapm marketplace remove NAME [-y|--yes]");

  try {
    const source = getMarketplace(name);
    if (!yes) {
      const confirmed = await promptConfirm(`Remove marketplace '${source.name}'? [y/N] `);
      if (!confirmed) {
        return fail(
          deps,
          `Refused to remove '${source.name}' without confirmation ` +
            `(non-interactive sessions require -y/--yes).`,
        );
      }
    }
    clearMarketplaceCache(source);
    removeMarketplace(source.name);
    console.log(`Removed marketplace '${source.name}'.`);
    return { ok: true, exitCode: 0 };
  } catch (err) {
    if (err instanceof MarketplaceNotFoundError) {
      return fail(deps, err.message);
    }
    return fail(deps, err instanceof Error ? err.message : String(err));
  }
}

async function runValidate(deps: MarketplaceCliDeps, argv: string[]): Promise<LifecycleResult> {
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(formatMarketplaceHelp(deps));
      return { ok: true, exitCode: 0 };
    }
    if (arg.startsWith("-")) return fail(deps, `Unknown marketplace validate flag: ${arg}`);
  }
  const name = argv[0];
  if (!name) return fail(deps, "Usage: bapm marketplace validate NAME");
  try {
    const source = getMarketplace(name);
    const manifest = await fetchMarketplace(source, { forceRefresh: true });
    console.log(`Validating marketplace '${source.name}'…`);
    const ok = printValidation(validateMarketplace(manifest));
    if (!ok) {
      return fail(deps, `Validation failed for marketplace '${source.name}'.`);
    }
    console.log("Validation passed.");
    return { ok: true, exitCode: 0 };
  } catch (err) {
    if (err instanceof MarketplaceFetchError || err instanceof MarketplaceNotFoundError) {
      return fail(deps, err.message);
    }
    return fail(deps, err instanceof Error ? err.message : String(err));
  }
}

export async function runMarketplaceCli(
  deps: MarketplaceCliDeps,
  options: MarketplaceOptions,
): Promise<LifecycleResult> {
  const parsed = parseMarketplaceArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatMarketplaceHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    return fail(deps, parsed.error);
  }
  const cwd = options.cwd ?? process.cwd();
  switch (parsed.sub) {
    case "add":
      return runAdd(deps, parsed.rest ?? [], cwd);
    case "list":
      return runList(deps);
    case "browse":
      return runBrowse(deps, parsed.rest ?? []);
    case "update":
      return runUpdate(deps, parsed.rest ?? []);
    case "remove":
      return runRemove(deps, parsed.rest ?? []);
    case "validate":
      return runValidate(deps, parsed.rest ?? []);
    default:
      return fail(deps, `Unknown marketplace subcommand '${parsed.sub}'`);
  }
}
