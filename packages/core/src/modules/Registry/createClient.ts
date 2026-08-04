import { createHash } from "node:crypto";
import { RegistryError } from "./errors.ts";
import {
  authHeaders,
  createFetchTransport,
  joinRegistryUrl,
  mapHttpError,
  resolveRegistryToken,
} from "./transport.ts";
import type {
  CreateRegistryClientOptions,
  RegistryClient,
  RegistryHttpTransport,
  RegistryVersionInfo,
} from "./types.ts";

const DEFAULT_JSON_CAP = 10 * 1024 * 1024; // ~10 MiB

export function createRegistryClient(options: CreateRegistryClientOptions = {}): RegistryClient {
  const baseUrl = (options.baseUrl ?? options.url ?? options.registryUrl ?? "").replace(/\/+$/, "");
  if (!baseUrl) {
    throw new RegistryError("REGISTRY_CONFIG", "createRegistryClient requires baseUrl / url");
  }
  const transport: RegistryHttpTransport = options.transport ?? createFetchTransport();
  const maxJsonBytes = options.maxJsonBytes ?? DEFAULT_JSON_CAP;
  const token = resolveRegistryToken({
    token: options.token,
    registryName: options.registryName,
  });

  return {
    baseUrl,
    async listVersions(owner: string, repo: string): Promise<RegistryVersionInfo[]> {
      const url = joinRegistryUrl(
        baseUrl,
        `/v1/packages/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/versions`,
      );
      const res = await transport.fetch({
        method: "GET",
        url,
        headers: authHeaders(token),
      });
      const bodyText = utf8(res.body);
      if (res.status < 200 || res.status >= 300) {
        throw mapHttpError(res.status, "GET", url, bodyText);
      }
      if (res.body.byteLength > maxJsonBytes) {
        throw new RegistryError(
          "REGISTRY_PARSE",
          `Registry list response exceeds ${maxJsonBytes} byte JSON cap`,
          { details: { url, size: res.body.byteLength } },
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyText);
      } catch (cause) {
        throw new RegistryError(
          "REGISTRY_PARSE",
          `Registry list response is not valid JSON for ${url}`,
          { cause, details: { url } },
        );
      }
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { versions?: unknown }).versions)
      ) {
        throw new RegistryError(
          "REGISTRY_PARSE",
          `Registry list JSON missing versions array for ${url}`,
          { details: { url } },
        );
      }
      const versions: RegistryVersionInfo[] = [];
      for (const entry of (parsed as { versions: unknown[] }).versions) {
        if (entry === null || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        if (typeof e.version !== "string" || typeof e.digest !== "string") {
          throw new RegistryError(
            "REGISTRY_PARSE",
            `Registry version entry missing version/digest for ${url}`,
            { details: { url } },
          );
        }
        versions.push({
          version: e.version,
          digest: e.digest,
          published_at: typeof e.published_at === "string" ? e.published_at : undefined,
        });
      }
      return versions;
    },

    async download(owner: string, repo: string, version: string): Promise<Uint8Array> {
      const url = joinRegistryUrl(
        baseUrl,
        `/v1/packages/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/versions/${encodeURIComponent(version)}/download`,
      );
      const res = await transport.fetch({
        method: "GET",
        url,
        headers: authHeaders(token),
      });
      if (res.status < 200 || res.status >= 300) {
        throw mapHttpError(res.status, "GET", url, utf8(res.body));
      }
      return res.body;
    },

    async publish(owner: string, repo: string, version: string, bytes: Uint8Array): Promise<void> {
      const url = joinRegistryUrl(
        baseUrl,
        `/v1/packages/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/versions/${encodeURIComponent(version)}`,
      );
      const res = await transport.fetch({
        method: "PUT",
        url,
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/zip",
        },
        body: bytes,
      });
      if (res.status < 200 || res.status >= 300) {
        throw mapHttpError(res.status, "PUT", url, utf8(res.body));
      }
    },
  };
}

export function sha256Hex(content: Uint8Array | Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function sha256Digest(content: Uint8Array | Buffer | string): string {
  return `sha256:${sha256Hex(content)}`;
}

/** Normalize and compare digests (`sha256:<hex>` or bare hex). */
export function digestsEqual(expected: string, actualHexOrDigest: string): boolean {
  const norm = (s: string) => {
    const t = s.trim().toLowerCase();
    return t.startsWith("sha256:") ? t.slice("sha256:".length) : t;
  };
  return norm(expected) === norm(actualHexOrDigest);
}

export function verifyArchiveDigest(
  bytes: Uint8Array,
  expectedDigest: string,
  options?: { label?: string },
): string {
  const actual = sha256Digest(bytes);
  if (!digestsEqual(expectedDigest, actual)) {
    throw new RegistryError(
      "REGISTRY_DIGEST",
      `Archive digest mismatch (lk-013 integrity): expected ${expectedDigest}, got ${actual}${options?.label ? ` for ${options.label}` : ""}`,
      { details: { expected: expectedDigest, actual } },
    );
  }
  return actual;
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
