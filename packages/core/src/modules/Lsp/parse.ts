import type { LspDeclarationContext, ParsedLspServer } from "./types.ts";

const NAME_RE = /^[a-zA-Z0-9@_][a-zA-Z0-9._@/:=-]{0,127}$/;
const LANGUAGE_KEYS = ["extensionToLanguage", "fileExtensions", "extension_to_language"] as const;

/** Fail-closed error for one unsupported or invalid LSP declaration. */
export class LspDeclarationError extends Error {
  readonly code = "LSP_DECLARATION_INVALID";
  readonly server?: string;
  readonly packageName?: string;
  readonly path?: string;

  constructor(message: string, context: LspDeclarationContext & { server?: string } = {}) {
    super(
      `${message}${context.packageName ? ` (package "${context.packageName}")` : ""}${
        context.path ? ` at ${context.path}` : ""
      }`,
    );
    this.name = "LspDeclarationError";
    this.server = context.server;
    this.packageName = context.packageName;
    this.path = context.path;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknownPathSegments(value: string, field: string, name: string): void {
  if (value.includes("\0")) {
    throw new LspDeclarationError(`LSP server "${name}": '${field}' must not contain NUL bytes`, {
      server: name,
    });
  }
  const segments = value.split(/[\\/]+/);
  if (segments.includes("..")) {
    throw new LspDeclarationError(
      `LSP server "${name}": '${field}' must not contain '..' path segments`,
      { server: name },
    );
  }
}

function readOptionalString(
  entry: Record<string, unknown>,
  keys: readonly string[],
  server: string,
): string | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || value.trim() === "") {
      throw new LspDeclarationError(`LSP server "${server}": '${key}' must be a non-empty string`, {
        server,
      });
    }
    return value.trim();
  }
  return undefined;
}

function readOptionalNumber(
  entry: Record<string, unknown>,
  keys: readonly string[],
  server: string,
): number | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new LspDeclarationError(
        `LSP server "${server}": '${key}' must be a non-negative number`,
        { server },
      );
    }
    return value;
  }
  return undefined;
}

function readLanguageMap(entry: Record<string, unknown>, server: string): Record<string, string> {
  let value: unknown;
  for (const key of LANGUAGE_KEYS) {
    if (entry[key] !== undefined && entry[key] !== null) {
      value = entry[key];
      break;
    }
  }
  if (value === undefined) {
    throw new LspDeclarationError(
      `LSP server "${server}" requires 'extensionToLanguage' (or 'fileExtensions')`,
      { server },
    );
  }
  if (!isPlainObject(value)) {
    throw new LspDeclarationError(
      `LSP server "${server}": language map must be a mapping of extension to language id`,
      { server },
    );
  }
  const out: Record<string, string> = {};
  for (const [extension, language] of Object.entries(value)) {
    if (typeof extension !== "string" || extension.trim() === "") {
      throw new LspDeclarationError(
        `LSP server "${server}": language map keys must be non-empty strings`,
        { server },
      );
    }
    if (typeof language !== "string" || language.trim() === "") {
      throw new LspDeclarationError(
        `LSP server "${server}": language map value for "${extension}" must be a non-empty string`,
        { server },
      );
    }
    out[extension] = language;
  }
  if (Object.keys(out).length === 0) {
    throw new LspDeclarationError(`LSP server "${server}": language map must not be empty`, {
      server,
    });
  }
  return out;
}

/**
 * Parse one LSP declaration object.
 *
 * Supported by the deploying hosts: stdio `command` servers with an extension
 * language map. Remote `url`, non-stdio transports, and string-only name
 * references fail closed instead of writing a host config the host cannot run.
 */
export function parseLspDeclaration(
  raw: unknown,
  context: LspDeclarationContext = {},
): ParsedLspServer {
  if (typeof raw === "string") {
    throw new LspDeclarationError(
      `LSP entry "${raw}" must be an object with name, command, and extensionToLanguage; ` +
        "bare server-name references are not deployable",
      { ...context, server: raw },
    );
  }
  if (!isPlainObject(raw)) {
    throw new LspDeclarationError(
      "LSP entry must be a mapping with name, command, and extensionToLanguage",
      context,
    );
  }

  const rawName = raw.name;
  if (typeof rawName !== "string" || rawName.trim() === "") {
    throw new LspDeclarationError("LSP entry requires a non-empty 'name'", context);
  }
  const name = rawName.trim();
  if (!NAME_RE.test(name)) {
    throw new LspDeclarationError(
      `Invalid LSP server name "${name}": must start with a letter, digit, '@', or '_' and ` +
        "contain only [a-zA-Z0-9._@/:=-] (max 128 chars)",
      { ...context, server: name },
    );
  }
  if (name.split("/").includes("..")) {
    throw new LspDeclarationError(
      `Invalid LSP server name "${name}": must not contain '..' path segments`,
      { ...context, server: name },
    );
  }

  const command = readOptionalString(raw, ["command"], name);
  const url = readOptionalString(raw, ["url"], name);
  const transport = readOptionalString(raw, ["transport"], name)?.toLowerCase();

  if (!command) {
    if (url) {
      throw new LspDeclarationError(
        `LSP server "${name}": remote 'url' entries are not supported by Claude/Copilot; ` +
          "declare a stdio 'command' instead",
        { ...context, server: name },
      );
    }
    throw new LspDeclarationError(`LSP server "${name}" requires 'command'`, {
      ...context,
      server: name,
    });
  }
  rejectUnknownPathSegments(command, "command", name);

  if (url) {
    throw new LspDeclarationError(
      `LSP server "${name}": remote 'url' entries are not supported by Claude/Copilot`,
      { ...context, server: name },
    );
  }
  if (transport !== undefined && transport !== "stdio") {
    throw new LspDeclarationError(
      `LSP server "${name}" has unsupported transport "${transport}"; only "stdio" is deployable`,
      { ...context, server: name },
    );
  }

  let args: string[] | undefined;
  if (raw.args !== undefined && raw.args !== null) {
    if (!Array.isArray(raw.args) || raw.args.some((arg) => typeof arg !== "string")) {
      throw new LspDeclarationError(`LSP server "${name}": 'args' must be a list of strings`, {
        ...context,
        server: name,
      });
    }
    args = [...(raw.args as string[])];
  }

  let env: Record<string, string> | undefined;
  if (raw.env !== undefined && raw.env !== null) {
    if (!isPlainObject(raw.env)) {
      throw new LspDeclarationError(
        `LSP server "${name}": 'env' must be a mapping of string values`,
        { ...context, server: name },
      );
    }
    env = {};
    for (const [key, value] of Object.entries(raw.env)) {
      if (typeof value !== "string") {
        throw new LspDeclarationError(
          `LSP server "${name}": env value for "${key}" must be a string`,
          { ...context, server: name },
        );
      }
      env[key] = value;
    }
  }

  const workspaceFolder = readOptionalString(raw, ["workspaceFolder", "workspace_folder"], name);
  if (workspaceFolder) rejectUnknownPathSegments(workspaceFolder, "workspaceFolder", name);

  let restartOnCrash: boolean | undefined;
  const rawRestart = raw.restartOnCrash ?? raw.restart_on_crash;
  if (rawRestart !== undefined && rawRestart !== null) {
    if (typeof rawRestart !== "boolean") {
      throw new LspDeclarationError(`LSP server "${name}": 'restartOnCrash' must be a boolean`, {
        ...context,
        server: name,
      });
    }
    restartOnCrash = rawRestart;
  }

  const startupTimeout = readOptionalNumber(raw, ["startupTimeout", "warmupTimeoutMs"], name);
  const shutdownTimeout = readOptionalNumber(raw, ["shutdownTimeout"], name);
  const maxRestarts = readOptionalNumber(raw, ["maxRestarts"], name);

  return {
    name,
    command,
    ...(args !== undefined ? { args } : {}),
    ...(env !== undefined ? { env } : {}),
    ...(transport !== undefined ? { transport } : {}),
    extensionToLanguage: readLanguageMap(raw, name),
    ...(startupTimeout !== undefined ? { startupTimeout } : {}),
    ...(shutdownTimeout !== undefined ? { shutdownTimeout } : {}),
    ...(restartOnCrash !== undefined ? { restartOnCrash } : {}),
    ...(maxRestarts !== undefined ? { maxRestarts } : {}),
    ...(workspaceFolder !== undefined ? { workspaceFolder } : {}),
    ...(raw.initializationOptions !== undefined
      ? { initializationOptions: raw.initializationOptions }
      : {}),
    ...(raw.settings !== undefined ? { settings: raw.settings } : {}),
    raw: { ...raw },
  };
}

/** Parse a `dependencies.lsp` list, rejecting duplicate server names. */
export function parseLspDeclarations(
  raw: unknown,
  context: LspDeclarationContext = {},
): ParsedLspServer[] {
  if (raw === undefined || raw === null || raw === false) return [];
  if (!Array.isArray(raw)) {
    throw new LspDeclarationError(
      "LSP declarations must be a list; use 'lsp: []' or a list of server objects",
      context,
    );
  }
  const out: ParsedLspServer[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (item === undefined || item === null || item === false) continue;
    const parsed = parseLspDeclaration(item, context);
    if (seen.has(parsed.name)) {
      throw new LspDeclarationError(
        `Duplicate LSP server "${parsed.name}" in the same dependency list`,
        { ...context, server: parsed.name },
      );
    }
    seen.add(parsed.name);
    out.push(parsed);
  }
  return out;
}
