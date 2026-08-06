import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type PluginJsonAuthor = {
  name: string;
};

export type CreatePluginJsonOptions = {
  name: string;
  version?: string;
  description?: string;
  author?: PluginJsonAuthor;
  license?: string;
};

export type PluginJsonDocument = {
  name: string;
  version: string;
  description: string;
  author: PluginJsonAuthor;
  license: string;
};

export type WritePluginJsonOptions = CreatePluginJsonOptions & {
  cwd?: string;
  /** Explicit destination path (defaults to `<cwd>/plugin.json`). */
  path?: string;
};

/**
 * Build an in-memory `plugin.json` document (APM-shaped thin scaffold).
 */
export function createPluginJson(options: CreatePluginJsonOptions): PluginJsonDocument {
  const name = typeof options.name === "string" ? options.name.trim() : "";
  if (!name) {
    throw new Error('plugin.json requires non-empty "name"');
  }

  return {
    name,
    version:
      typeof options.version === "string" && options.version.length > 0
        ? options.version
        : "0.1.0",
    description: typeof options.description === "string" ? options.description : "",
    author: {
      name:
        options.author && typeof options.author.name === "string" && options.author.name.length > 0
          ? options.author.name
          : "author",
    },
    license:
      typeof options.license === "string" && options.license.length > 0
        ? options.license
        : "MIT",
  };
}

/** Alias accepted by acceptance helpers. */
export const createPluginJsonDocument = createPluginJson;
export const buildPluginJson = createPluginJson;

/**
 * Serialize `plugin.json` with indent width 2 and a trailing newline.
 */
export function serializePluginJson(document: PluginJsonDocument | Record<string, unknown>): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * Write `plugin.json` to disk (indent 2 + trailing newline). Offline only.
 */
export function writePluginJson(options: WritePluginJsonOptions): string {
  const cwd = resolve(options.cwd ?? process.cwd());
  const dest = options.path ? resolve(options.path) : resolve(cwd, "plugin.json");
  const document = createPluginJson(options);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, serializePluginJson(document), "utf8");
  return dest;
}

/** Aliases for acceptance naming flexibility. */
export const writePluginJsonFile = writePluginJson;
export const emitPluginJson = writePluginJson;
