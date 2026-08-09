/**
 * Bake-time resolution of MCP env/header placeholder syntaxes.
 * Cursor path: legacy bake only (literals), no runtime translate-mode.
 *
 * Supported forms:
 * - APM: `${VAR}` / `${env:VAR}` / legacy `<VAR>` (uppercase identifier only)
 * - bapm-only: `{bake:NAME}` / `{bake:env:NAME}`
 */

/**
 * Single-pass: legacy `<VAR>` OR `${VAR}` / `${env:VAR}` OR `{bake:NAME}` / `{bake:env:NAME}`.
 * group(1) = angle name; group(2) = APM brace name; group(3) = bake directive name.
 * Intentionally does not match `${input:…}` or GitHub Actions `${{ … }}`.
 */
const ENV_PLACEHOLDER_RE =
  /<([A-Z_][A-Z0-9_]*)>|\$\{(?:env:)?([A-Za-z_][A-Za-z0-9_]*)\}|\{bake:(?:env:)?([A-Za-z_][A-Za-z0-9_]*)\}/g;

export type BakeMcpStringMapOptions = {
  /** Prefer these over `env` / `process.env` when non-empty. */
  overrides?: Record<string, string>;
  /** Lookup environment; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /**
   * Project manifest top-level `env` defaults.
   * Lookup order: overrides → process/`env` → `manifestEnv` (non-empty only).
   */
  manifestEnv?: Record<string, string>;
  /**
   * `bake` (default): resolve APM `${VAR}` / `${env:VAR}` / `<VAR>` and `{bake:NAME}`.
   * `translate`: leave APM placeholders untouched; still resolve `{bake:NAME}` (fail-closed).
   */
  mode?: "bake" | "translate";
};

export class McpEnvBakeError extends Error {
  readonly code = "MCP_ENV_BAKE";
  readonly missing: string[];

  constructor(missing: string[]) {
    const unique = [...new Set(missing)];
    const listed = unique.join(", ");
    super(
      unique.length === 1
        ? `MCP env bake failed: unresolved placeholder for ${listed}`
        : `MCP env bake failed: unresolved placeholders for ${listed}`,
    );
    this.name = "McpEnvBakeError";
    this.missing = unique;
  }
}

function nonEmpty(value: string | undefined): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value;
}

function lookupVar(name: string, options: BakeMcpStringMapOptions | undefined): string | undefined {
  const fromOverride = nonEmpty(options?.overrides?.[name]);
  if (fromOverride !== undefined) return fromOverride;

  const source = options?.env ?? process.env;
  const fromEnv = nonEmpty(source[name]);
  if (fromEnv !== undefined) return fromEnv;

  return nonEmpty(options?.manifestEnv?.[name]);
}

function hasPlaceholder(value: string): boolean {
  ENV_PLACEHOLDER_RE.lastIndex = 0;
  return ENV_PLACEHOLDER_RE.test(value);
}

/**
 * Resolve placeholders in a single string. Throws {@link McpEnvBakeError} if any
 * required placeholder cannot be resolved to a non-empty value.
 */
export function bakeMcpStringValue(value: string, options?: BakeMcpStringMapOptions): string {
  if (!hasPlaceholder(value)) return value;

  const translate = options?.mode === "translate";
  const missing: string[] = [];
  ENV_PLACEHOLDER_RE.lastIndex = 0;
  const baked = value.replace(
    ENV_PLACEHOLDER_RE,
    (match, angleName: string, braceName: string, bakeName: string) => {
      // Translate hosts keep APM / legacy placeholders for runtime expansion.
      if (translate && !bakeName) return match;

      const varName = angleName || braceName || bakeName;
      const resolved = lookupVar(varName, options);
      if (resolved === undefined) {
        missing.push(varName);
        return match;
      }
      return resolved;
    },
  );

  if (missing.length > 0) {
    throw new McpEnvBakeError(missing);
  }
  return baked;
}

/**
 * Bake-time resolve for MCP `env` / `headers` string maps.
 * Values without placeholders pass through unchanged.
 */
export function bakeMcpStringMap(
  map: Record<string, string>,
  options?: BakeMcpStringMapOptions,
): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];

  for (const [key, raw] of Object.entries(map)) {
    if (typeof raw !== "string") {
      out[key] = String(raw);
      continue;
    }
    if (!hasPlaceholder(raw)) {
      out[key] = raw;
      continue;
    }
    try {
      out[key] = bakeMcpStringValue(raw, options);
    } catch (error) {
      if (error instanceof McpEnvBakeError) {
        missing.push(...error.missing);
        out[key] = raw;
        continue;
      }
      throw error;
    }
  }

  if (missing.length > 0) {
    throw new McpEnvBakeError(missing);
  }
  return out;
}

export type BakeableMcpServer = {
  env?: Record<string, string>;
  headers?: Record<string, string>;
  [key: string]: unknown;
};

/**
 * Bake `env` and `headers` on a server config; other fields unchanged.
 */
export function bakeMcpServerMaps<T extends BakeableMcpServer>(
  server: T,
  options?: BakeMcpStringMapOptions,
): T {
  const next: BakeableMcpServer = { ...server };
  if (server.env && typeof server.env === "object") {
    next.env = bakeMcpStringMap(server.env, options);
  }
  const headers = server.headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    const stringHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === "string") stringHeaders[k] = v;
    }
    if (Object.keys(stringHeaders).length > 0) {
      next.headers = bakeMcpStringMap(stringHeaders, options);
    }
  }
  return next as T;
}
