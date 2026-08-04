import { RegistryError } from "./errors.ts";
import type { RegistryHttpRequest, RegistryHttpResponse, RegistryHttpTransport } from "./types.ts";

/** Default real-fetch transport. */
export function createFetchTransport(): RegistryHttpTransport {
  return {
    async fetch(request: RegistryHttpRequest): Promise<RegistryHttpResponse> {
      const init: RequestInit = {
        method: request.method,
        headers: request.headers,
      };
      if (request.body !== undefined) {
        init.body = Buffer.from(request.body);
      }
      let response: Response;
      try {
        response = await fetch(request.url, init);
      } catch (cause) {
        throw new RegistryError(
          "REGISTRY_HTTP",
          `Registry network error fetching ${request.method} ${request.url}: ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause, details: { url: request.url, method: request.method } },
        );
      }
      const ab = await response.arrayBuffer();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      return {
        status: response.status,
        headers,
        body: new Uint8Array(ab),
      };
    },
  };
}

export function resolveRegistryToken(options?: {
  token?: string;
  registryName?: string;
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  if (typeof options?.token === "string" && options.token.length > 0) {
    return options.token;
  }
  const env = options?.env ?? process.env;
  const name = options?.registryName?.trim();
  if (name) {
    const key = `BAPM_REGISTRY_${name.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}_TOKEN`;
    const named = env[key];
    if (typeof named === "string" && named.length > 0) return named;
  }
  const global = env.BAPM_REGISTRY_TOKEN;
  if (typeof global === "string" && global.length > 0) return global;
  return undefined;
}

export function joinRegistryUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function authHeaders(token: string | undefined): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function mapHttpError(
  status: number,
  method: string,
  url: string,
  bodyText: string,
): RegistryError {
  const snippet = bodyText.slice(0, 200);
  if (status === 401 || status === 403) {
    return new RegistryError(
      "REGISTRY_AUTH",
      `Registry ${method} ${url} returned ${status} (unauthorized/forbidden). Set BAPM_REGISTRY_TOKEN (or BAPM_REGISTRY_<NAME>_TOKEN) with a Bearer token. ${snippet}`,
      { status, details: { url, method } },
    );
  }
  if (status === 409) {
    return new RegistryError(
      "REGISTRY_CONFLICT",
      `Registry returned 409 conflict — version already published (immutability). Bump the package version and retry. ${snippet}`,
      { status, details: { url, method } },
    );
  }
  if (status === 422) {
    return new RegistryError(
      "REGISTRY_VALIDATION",
      `Registry returned 422 validation failure for ${method} ${url}. ${snippet}`,
      { status, details: { url, method } },
    );
  }
  return new RegistryError(
    "REGISTRY_HTTP",
    `Registry ${method} ${url} failed with HTTP ${status}. ${snippet}`,
    { status, details: { url, method } },
  );
}
