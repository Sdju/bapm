import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve as pathResolve, sep } from "node:path";
import {
  cacheKeyForSource,
  clearMarketplaceCache as clearCacheImpl,
  readMarketplaceCache,
  writeMarketplaceCache,
} from "./cache.ts";
import { MarketplaceFetchError } from "./errors.ts";
import {
  MarketplaceSource,
  resolveLocalFilesystemPath,
  type MarketplaceManifest,
} from "./models.ts";
import { parseMarketplaceJson } from "./parse.ts";
import type { MarketplaceConfigOptions, MarketplaceFetchOptions } from "./types.ts";

export const MAX_MARKETPLACE_JSON_BYTES = 10 * 1024 * 1024;
export const MARKETPLACE_PATHS = [
  "marketplace.json",
  ".github/plugin/marketplace.json",
  ".claude-plugin/marketplace.json",
] as const;

const SAFE_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function validateRef(ref: string, sourceName: string): string {
  if (!SAFE_REF_RE.test(ref || "")) {
    throw new MarketplaceFetchError(
      sourceName,
      `Invalid git ref '${ref}': refs must match ${SAFE_REF_RE.source}`,
    );
  }
  return ref;
}

function assertNoTraversalSegments(relPath: string, sourceName: string): void {
  for (const seg of relPath.split(/[/\\]/).filter(Boolean)) {
    if (seg === ".." || seg === "." || seg === "") {
      throw new MarketplaceFetchError(sourceName, `path escapes marketplace root: ${relPath}`);
    }
  }
}

function ensureWithin(root: string, candidate: string, sourceName: string): string {
  const resolvedRoot = pathResolve(root);
  const resolved = pathResolve(candidate);
  const prefix = resolvedRoot.endsWith(sep) ? resolvedRoot : resolvedRoot + sep;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    throw new MarketplaceFetchError(sourceName, `path escapes marketplace root: ${candidate}`);
  }
  return resolved;
}

function resolveTransport(opts?: MarketplaceFetchOptions): typeof globalThis.fetch {
  return opts?.fetch ?? globalThis.fetch.bind(globalThis);
}

async function readBoundedBody(
  response: Response,
  sourceName: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new MarketplaceFetchError(
        sourceName,
        `marketplace.json exceeds ${maxBytes} bytes (size limit / too large)`,
      );
    }
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new MarketplaceFetchError(
        sourceName,
        `marketplace.json exceeds ${maxBytes} bytes (size limit / too large)`,
      );
    }
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        throw new MarketplaceFetchError(
          sourceName,
          `marketplace.json exceeds ${maxBytes} bytes (size limit / too large)`,
        );
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function parseJsonObject(raw: Uint8Array, sourceName: string): Record<string, unknown> {
  let text: string;
  try {
    text = new TextDecoder("utf-8").decode(raw);
  } catch (err) {
    throw new MarketplaceFetchError(sourceName, `invalid JSON response: ${String(err)}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch (err) {
    throw new MarketplaceFetchError(sourceName, `invalid JSON response: ${String(err)}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new MarketplaceFetchError(sourceName, "marketplace.json root must be an object");
  }
  return data as Record<string, unknown>;
}

async function fetchUrlDirect(
  source: MarketplaceSource,
  opts?: MarketplaceFetchOptions,
): Promise<{ data: Record<string, unknown>; digest: string }> {
  const url = source.url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MarketplaceFetchError(source.name, "invalid marketplace URL");
  }
  if (parsed.protocol.toLowerCase() !== "https:") {
    throw new MarketplaceFetchError(
      source.name,
      "remote marketplace.json URLs must use HTTPS (insecure HTTP rejected)",
    );
  }

  const transport = resolveTransport(opts);
  const response = await transport(url, {
    redirect: "manual",
    headers: { "User-Agent": "bapm" },
  });

  // Follow redirects manually so we can reject HTTP landings.
  let current = response;
  let currentUrl = url;
  let hops = 0;
  while (current.status >= 300 && current.status < 400 && hops < 5) {
    const loc = current.headers.get("location");
    if (!loc) break;
    const next = new URL(loc, currentUrl);
    if (next.protocol.toLowerCase() !== "https:") {
      throw new MarketplaceFetchError(source.name, "redirect to non-HTTPS URL rejected");
    }
    currentUrl = next.toString();
    current = await transport(currentUrl, {
      redirect: "manual",
      headers: { "User-Agent": "bapm" },
    });
    hops += 1;
  }

  if (current.status === 404) {
    throw new MarketplaceFetchError(source.name, "404 Not Found");
  }
  if (!current.ok) {
    throw new MarketplaceFetchError(source.name, `HTTP ${current.status}`);
  }

  const raw = await readBoundedBody(current, source.name, MAX_MARKETPLACE_JSON_BYTES);
  const digest = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
  return { data: parseJsonObject(raw, source.name), digest };
}

function readLocalFile(source: MarketplaceSource, filePath: string): Record<string, unknown> {
  try {
    const text = readFileSync(filePath, "utf8");
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new MarketplaceFetchError(source.name, "marketplace.json root must be an object");
    }
    return data as Record<string, unknown>;
  } catch (err) {
    if (err instanceof MarketplaceFetchError) throw err;
    throw new MarketplaceFetchError(source.name, `failed to read ${filePath}: ${String(err)}`);
  }
}

function fetchLocalAtPath(
  source: MarketplaceSource,
  filePath: string,
): Record<string, unknown> | null {
  if (filePath) assertNoTraversalSegments(filePath, source.name);
  const root = resolveLocalFilesystemPath(source);
  if (!existsSync(root)) {
    throw new MarketplaceFetchError(source.name, `local marketplace path does not exist: ${root}`);
  }
  const st = statSync(root);
  if (st.isFile()) {
    return readLocalFile(source, root);
  }
  if (!filePath) return null;
  const candidate = ensureWithin(root, join(root, filePath), source.name);
  if (!existsSync(candidate)) return null;
  return readLocalFile(source, candidate);
}

async function fetchGithubAtPath(
  source: MarketplaceSource,
  filePath: string,
  opts?: MarketplaceFetchOptions,
): Promise<Record<string, unknown> | null> {
  validateRef(source.ref || "main", source.name);
  if (!source.owner || !source.repo) {
    throw new MarketplaceFetchError(source.name, "github source requires owner/repo");
  }
  assertNoTraversalSegments(filePath, source.name);
  const encodedRef = encodeURIComponent(source.ref || "main");
  const apiUrl =
    `https://api.github.com/repos/${source.owner}/${source.repo}/contents/` +
    `${filePath.split("/").map(encodeURIComponent).join("/")}?ref=${encodedRef}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw",
    "User-Agent": "bapm",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const transport = resolveTransport(opts);
  const response = await transport(apiUrl, { headers });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new MarketplaceFetchError(source.name, `GitHub API HTTP ${response.status}`);
  }
  const raw = await readBoundedBody(response, source.name, MAX_MARKETPLACE_JSON_BYTES);
  // Raw accept may still return JSON metadata if Accept ignored — handle both.
  const text = new TextDecoder("utf-8").decode(raw);
  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof (parsed as { content?: unknown }).content === "string" &&
      (parsed as { encoding?: string }).encoding === "base64"
    ) {
      const content = Buffer.from((parsed as { content: string }).content, "base64");
      if (content.byteLength > MAX_MARKETPLACE_JSON_BYTES) {
        throw new MarketplaceFetchError(
          source.name,
          `marketplace.json exceeds ${MAX_MARKETPLACE_JSON_BYTES} bytes (size limit / too large)`,
        );
      }
      return parseJsonObject(content, source.name);
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (err) {
    if (err instanceof MarketplaceFetchError) throw err;
  }
  return parseJsonObject(raw, source.name);
}

async function autoDetectPath(
  source: MarketplaceSource,
  opts?: MarketplaceFetchOptions,
): Promise<{ path: string; data: Record<string, unknown> }> {
  for (const candidate of MARKETPLACE_PATHS) {
    const data =
      source.kind === "local"
        ? fetchLocalAtPath(source, candidate)
        : await fetchGithubAtPath(source, candidate, opts);
    if (data) return { path: candidate, data };
  }
  throw new MarketplaceFetchError(
    source.name,
    `marketplace.json not found (checked: ${MARKETPLACE_PATHS.join(", ")})`,
  );
}

function refuseUnsupported(source: MarketplaceSource): never {
  const kind = source.kind;
  throw new MarketplaceFetchError(
    source.name,
    `Unsupported marketplace source kind '${kind}' is not supported / out of scope ` +
      `(gitlab/ado/git hosts require mp-hosts-auth). Use github, url, or local.`,
  );
}

/**
 * Fetch and parse a marketplace manifest (github | url | local).
 */
export async function fetchMarketplace(
  source: MarketplaceSource | Record<string, unknown>,
  opts?: MarketplaceFetchOptions,
): Promise<MarketplaceManifest> {
  const src =
    source instanceof MarketplaceSource
      ? source
      : MarketplaceSource.fromDict(source as Record<string, unknown>);

  // Reject insecure HTTP before kind refuse so acceptance messages match.
  if (src.url.toLowerCase().startsWith("http://")) {
    throw new MarketplaceFetchError(
      src.name,
      "remote marketplace.json URLs must use HTTPS (insecure HTTP rejected)",
    );
  }

  const kind = src.kind;
  if (kind === "gitlab" || kind === "ado" || kind === "git") {
    refuseUnsupported(src);
  }

  const useCache = kind === "github" || kind === "url";
  const cacheName = cacheKeyForSource(src);

  if (useCache && !opts?.forceRefresh) {
    const cached = readMarketplaceCache(cacheName, opts);
    if (cached) {
      return parseMarketplaceJson(cached, src.name, {
        sourceUrl: kind === "url" ? src.url : "",
      });
    }
  }

  if (kind === "url") {
    const result = await fetchUrlDirect(src, opts);
    writeMarketplaceCache(cacheName, result.data, {
      ...opts,
      indexDigest: result.digest,
    });
    return parseMarketplaceJson(result.data, src.name, {
      sourceUrl: src.url,
      sourceDigest: result.digest,
    });
  }

  if (kind === "local") {
    const root = resolveLocalFilesystemPath(src);
    if (!existsSync(root)) {
      throw new MarketplaceFetchError(src.name, `local marketplace path does not exist: ${root}`);
    }
    if (statSync(root).isFile()) {
      const data = readLocalFile(src, root);
      return parseMarketplaceJson(data, src.name);
    }
    // Directory: empty path or default → auto-detect; else exact path.
    if (!src.path || src.path === "") {
      const detected = await autoDetectPath(src, opts);
      return parseMarketplaceJson(detected.data, src.name);
    }
    const data = fetchLocalAtPath(src, src.path);
    if (!data) {
      // Fall back to auto-detect when default marketplace.json missing.
      if (src.path === "marketplace.json") {
        const detected = await autoDetectPath(src, opts);
        return parseMarketplaceJson(detected.data, src.name);
      }
      throw new MarketplaceFetchError(src.name, `marketplace.json not found at '${src.path}'`);
    }
    return parseMarketplaceJson(data, src.name);
  }

  // github
  validateRef(src.ref || "main", src.name);
  let data: Record<string, unknown> | null = null;
  if (!src.path || src.path === "") {
    const detected = await autoDetectPath(src, opts);
    data = detected.data;
  } else {
    data = await fetchGithubAtPath(src, src.path, opts);
    if (!data && src.path === "marketplace.json") {
      const detected = await autoDetectPath(src, opts);
      data = detected.data;
    }
  }
  if (!data) {
    throw new MarketplaceFetchError(
      src.name,
      `marketplace.json not found at '${src.path || "auto"}'`,
    );
  }
  writeMarketplaceCache(cacheName, data, opts);
  return parseMarketplaceJson(data, src.name);
}

export function clearMarketplaceCache(
  source: MarketplaceSource | Record<string, unknown>,
  opts?: MarketplaceConfigOptions,
): number {
  const src =
    source instanceof MarketplaceSource
      ? source
      : MarketplaceSource.fromDict(source as Record<string, unknown>);
  return clearCacheImpl(src, opts);
}

export function autoDetectMarketplacePath(
  source: MarketplaceSource,
  opts?: MarketplaceFetchOptions,
): Promise<string> {
  return autoDetectPath(source, opts).then((r) => r.path);
}
