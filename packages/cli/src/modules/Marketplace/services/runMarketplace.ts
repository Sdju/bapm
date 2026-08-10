import {
  addMarketplace,
  addMarketplacePackage,
  autoDetectMarketplacePath,
  checkMarketplaceAuthoring,
  classifyMarketplaceHostKind,
  clearMarketplaceCache,
  createMarketplaceSource,
  fetchMarketplace,
  getMarketplace,
  initMarketplaceAuthoring,
  listMarketplaces,
  MarketplaceFetchError,
  MarketplaceNotFoundError,
  migrateMarketplaceYml,
  removeMarketplace,
  removeMarketplacePackage,
  setMarketplacePackage,
  urlNamesRemoteManifest,
  validateMarketplace,
  type MarketplaceSource,
} from "@b-apm/core";
import { existsSync, statSync } from "node:fs";
import { basename, resolve as pathResolve } from "node:path";
import { createInterface } from "node:readline";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

const ALIAS_RE = /^[a-zA-Z0-9._-]+$/;
const SUPPORTED_SUBCOMMANDS = new Set([
  "add",
  "list",
  "browse",
  "update",
  "remove",
  "validate",
  "init",
  "package",
  "check",
  "migrate",
]);
const PACKAGE_ACTIONS = new Set(["add", "set", "remove"]);

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

function kindHintForHost(host: string): string {
  try {
    return classifyMarketplaceHostKind(host);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

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
    const kindHint = isDirect ? "url" : kindHintForHost(embeddedHost);
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
  const kindHint = kindHintForHost(resolvedHost);
  return {
    url: `https://${resolvedHost}/${ownerPath}/${repoName}`,
    kindHint,
    host: resolvedHost,
    isDirectUrl: false,
    isLocal: false,
  };
}

export function formatMarketplaceHelp(deps: MarketplaceCliDeps): string {
  return `${deps.name} marketplace — Consumer registry and authoring for ${deps.manifestFile}

Usage:
  bapm marketplace <subcommand> [options]

Consumer:
  add SOURCE       Register a marketplace (probe-fetch before persist)
  list             List registered marketplaces
  browse NAME      List plugins in a registered marketplace
  update [NAME]    Clear cache and refetch (all if NAME omitted)
  remove NAME      Remove a registered marketplace (-y required non-interactive)
  validate NAME    Thin schema + duplicate-name checks (consumer marketplace.json)

Authoring:
  init             Scaffold marketplace: block in ${deps.manifestFile}
  package add|set|remove
                   Edit package entries in marketplace:
  check            Validate authoring schema (+ online github ls-remote)
  migrate          Fold legacy marketplace.yml into ${deps.manifestFile}

Authoring options:
  init:    --force  --owner <name>  --name <project>
  package: --name  --version  --ref  --subdir  --tag-pattern  --tags
           --include-prerelease  --no-verify  (-y for remove)
  check:   --offline
  migrate: --dry-run  --force / -y

Consumer add options:
  --name, -n <alias>   Display name (pattern [a-zA-Z0-9._-]+)
  --ref, -r <ref>      Git ref (default: main)
  --host <fqdn>        Host for OWNER/REPO shorthand (github.com, *.ghe.com, GITHUB_HOST GHES, gitlab, ado)
  -h, --help           Show this help

Not shipped in this release: outdated, audit.
Use check --offline for schema-only validation.
Host marketplace outputs are written by \`bapm pack\` (see \`bapm pack --help\`).
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

  if (parsed.kindHint === "git") {
    return fail(
      deps,
      `Unsupported marketplace host/kind 'git' ` +
        `(generic git not supported / out of scope). Use github, gitlab, ado, HTTPS marketplace.json, or local.`,
    );
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

async function runInit(
  deps: MarketplaceCliDeps,
  argv: string[],
  cwd: string,
): Promise<LifecycleResult> {
  let force = false;
  let owner: string | undefined;
  let name: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: bapm marketplace init [--force] [--owner NAME] [--name PROJECT]

Scaffold a marketplace: block in ${deps.manifestFile}. Creates a stub manifest
when missing. Does not emit host marketplace.json artifacts.
`);
      return { ok: true, exitCode: 0 };
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--owner") {
      owner = argv[++i];
      if (!owner) return fail(deps, "Missing value for --owner");
      continue;
    }
    if (arg === "--name") {
      name = argv[++i];
      if (!name) return fail(deps, "Missing value for --name");
      continue;
    }
    if (arg.startsWith("-")) return fail(deps, `Unknown marketplace init flag: ${arg}`);
    return fail(deps, `Unexpected argument for marketplace init: ${arg}`);
  }

  const result = initMarketplaceAuthoring({ cwd, owner, name, force });
  if (!result.ok) return fail(deps, result.error);
  console.log(
    result.createdManifest
      ? `Created ${deps.manifestFile} with marketplace: block (owner=${owner ?? "acme-org"}).`
      : `Wrote marketplace: block to ${deps.manifestFile} (owner=${owner ?? "acme-org"}).`,
  );
  console.log(
    "Tip: generated host marketplace.json paths (future pack) often should not be gitignored.",
  );
  return { ok: true, exitCode: 0 };
}

async function runPackage(
  deps: MarketplaceCliDeps,
  argv: string[],
  cwd: string,
): Promise<LifecycleResult> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(`Usage:
  bapm marketplace package add SOURCE [--name NAME] [--version V | --ref REF] [options]
  bapm marketplace package set NAME [--source S] [--version V | --ref REF] [options]
  bapm marketplace package remove NAME -y

Options: --subdir --tag-pattern --tags --include-prerelease --no-verify
`);
    return { ok: true, exitCode: 0 };
  }
  const action = argv[0]!;
  if (!PACKAGE_ACTIONS.has(action)) {
    return fail(deps, `Unknown marketplace package action '${action}' (expected add|set|remove)`);
  }
  const rest = argv.slice(1);

  if (action === "remove") {
    let yes = false;
    const positional: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i]!;
      if (arg === "-y" || arg === "--yes") {
        yes = true;
        continue;
      }
      if (arg.startsWith("-")) return fail(deps, `Unknown package remove flag: ${arg}`);
      positional.push(arg);
    }
    if (positional.length !== 1) {
      return fail(deps, "Usage: bapm marketplace package remove NAME -y");
    }
    if (!yes && !process.stdin.isTTY) {
      return fail(deps, "Non-interactive package remove requires -y / --yes");
    }
    if (!yes) {
      const ok = await promptConfirm(`Remove package '${positional[0]}'? [y/N] `);
      if (!ok) return fail(deps, "Aborted.");
    }
    const result = removeMarketplacePackage({ cwd, name: positional[0]! });
    if (!result.ok) return fail(deps, result.error);
    console.log(`Removed package '${positional[0]}'.`);
    return { ok: true, exitCode: 0 };
  }

  let pkgName: string | undefined;
  let version: string | undefined;
  let ref: string | undefined;
  let subdir: string | undefined;
  let tagPattern: string | undefined;
  let tags: string | undefined;
  let includePrerelease = false;
  let noVerify = false;
  let source: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg === "--name" || arg === "-n") {
      pkgName = rest[++i];
      if (!pkgName) return fail(deps, "Missing value for --name");
      continue;
    }
    if (arg === "--version") {
      version = rest[++i];
      if (!version) return fail(deps, "Missing value for --version");
      continue;
    }
    if (arg === "--ref" || arg === "-r") {
      ref = rest[++i];
      if (!ref) return fail(deps, "Missing value for --ref");
      continue;
    }
    if (arg === "--source") {
      source = rest[++i];
      if (!source) return fail(deps, "Missing value for --source");
      continue;
    }
    if (arg === "--subdir") {
      subdir = rest[++i];
      if (!subdir) return fail(deps, "Missing value for --subdir");
      continue;
    }
    if (arg === "--tag-pattern") {
      tagPattern = rest[++i];
      if (!tagPattern) return fail(deps, "Missing value for --tag-pattern");
      continue;
    }
    if (arg === "--tags") {
      tags = rest[++i];
      if (!tags) return fail(deps, "Missing value for --tags");
      continue;
    }
    if (arg === "--include-prerelease") {
      includePrerelease = true;
      continue;
    }
    if (arg === "--no-verify") {
      noVerify = true;
      continue;
    }
    if (arg.startsWith("-")) return fail(deps, `Unknown package ${action} flag: ${arg}`);
    positional.push(arg);
  }

  if (version !== undefined && ref !== undefined) {
    return fail(deps, "Do not set both --version and --ref (mutually exclusive)");
  }

  if (action === "add") {
    const src = source ?? positional[0];
    if (!src) return fail(deps, "Usage: bapm marketplace package add SOURCE [--name NAME] …");
    const name =
      pkgName ??
      src
        .replace(/\.git$/, "")
        .split("/")
        .filter(Boolean)
        .at(-1);
    if (!name) return fail(deps, "Could not derive package name; pass --name");
    const result = addMarketplacePackage({
      cwd,
      name,
      source: src,
      version,
      ref,
      subdir,
      tagPattern,
      tags,
      includePrerelease,
      noVerify,
    });
    if (!result.ok) return fail(deps, result.error);
    console.log(`Added package '${name}' (${src}).`);
    return { ok: true, exitCode: 0 };
  }

  // set
  const setName = pkgName ?? positional[0];
  if (!setName) return fail(deps, "Usage: bapm marketplace package set NAME [options]");
  const result = setMarketplacePackage({
    cwd,
    name: setName,
    source,
    version,
    ref,
    subdir,
    tagPattern,
    tags,
    includePrerelease,
  });
  if (!result.ok) return fail(deps, result.error);
  console.log(`Updated package '${setName}'.`);
  return { ok: true, exitCode: 0 };
}

async function runCheck(
  deps: MarketplaceCliDeps,
  argv: string[],
  cwd: string,
): Promise<LifecycleResult> {
  let offline = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: bapm marketplace check [--offline]

Validate marketplace: authoring schema. Without --offline, probes github
owner/repo reachability via ambient git ls-remote. Non-github hosts warn
(schema-only). Local ./ sources skip network.
`);
      return { ok: true, exitCode: 0 };
    }
    if (arg === "--offline") {
      offline = true;
      continue;
    }
    if (arg.startsWith("-")) return fail(deps, `Unknown marketplace check flag: ${arg}`);
    return fail(deps, `Unexpected argument for marketplace check: ${arg}`);
  }

  const result = await checkMarketplaceAuthoring({ cwd, offline });
  for (const w of result.warnings) {
    console.log(`Warning: ${w}`);
  }
  for (const e of result.errors) console.error(`Error: ${e}`);
  if (!result.ok) {
    return fail(deps, `Marketplace check failed (${result.errors.length} error(s)).`);
  }
  console.log(
    offline ? "Marketplace check passed (offline / schema-only)." : "Marketplace check passed.",
  );
  return { ok: true, exitCode: 0 };
}

async function runMigrate(
  deps: MarketplaceCliDeps,
  argv: string[],
  cwd: string,
): Promise<LifecycleResult> {
  let dryRun = false;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: bapm marketplace migrate [--dry-run] [--force|-y]

Fold legacy marketplace.yml into ${deps.manifestFile} marketplace: block.
`);
      return { ok: true, exitCode: 0 };
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--force" || arg === "-y" || arg === "--yes") {
      force = true;
      continue;
    }
    if (arg.startsWith("-")) return fail(deps, `Unknown marketplace migrate flag: ${arg}`);
    return fail(deps, `Unexpected argument for marketplace migrate: ${arg}`);
  }

  const result = migrateMarketplaceYml({ cwd, dryRun, force });
  if (!result.ok) return fail(deps, result.error ?? "migrate failed");
  console.log(result.message ?? (dryRun ? "Dry-run OK." : "Migrated."));
  return { ok: true, exitCode: 0 };
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
    case "init":
      return runInit(deps, parsed.rest ?? [], cwd);
    case "package":
      return runPackage(deps, parsed.rest ?? [], cwd);
    case "check":
      return runCheck(deps, parsed.rest ?? [], cwd);
    case "migrate":
      return runMigrate(deps, parsed.rest ?? [], cwd);
    default:
      return fail(deps, `Unknown marketplace subcommand '${parsed.sub}'`);
  }
}
