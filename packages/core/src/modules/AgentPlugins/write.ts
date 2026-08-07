import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { AgentPluginsError } from "./errors.ts";
import { validateAgentPluginManifest } from "./load.ts";
import {
  AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
  type AgentPluginManifest,
  type CreateAgentPluginManifestOptions,
  type WrittenAgentPluginManifest,
  type WriteAgentPluginManifestOptions,
} from "./types.ts";

/**
 * Build the canonical portable v1 manifest. This is deliberately independent
 * from Manifest/pluginJson.ts: APM producer metadata has different semantics.
 */
export function createAgentPluginManifest(
  options: CreateAgentPluginManifestOptions,
): AgentPluginManifest {
  const candidate: Record<string, unknown> = {
    $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
    name: options.name,
  };

  for (const field of ["version", "description", "homepage", "repository", "license"] as const) {
    if (options[field] !== undefined) candidate[field] = options[field];
  }
  if (options.author !== undefined) candidate.author = options.author;
  if (options.keywords !== undefined) candidate.keywords = options.keywords;
  if (options.extensions !== undefined) candidate.extensions = options.extensions;

  return validateAgentPluginManifest(candidate).manifest;
}

export function serializeAgentPluginManifest(manifest: AgentPluginManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Validate before writing a portable root manifest. The output is always a
 * regular `plugin.json`; it never creates an APM `bapm.yml` dependency contract.
 */
export function writeAgentPluginManifest(
  options: WriteAgentPluginManifestOptions,
): WrittenAgentPluginManifest {
  const root = resolve(options.root ?? (options.path ? dirname(options.path) : process.cwd()));
  const manifestPath = resolve(options.path ?? join(root, "plugin.json"));
  if (manifestPath !== join(root, "plugin.json")) {
    throw new AgentPluginsError(
      "AGENT_PLUGIN_MANIFEST_INVALID",
      `Agent Plugin manifest must be written as ${join(root, "plugin.json")}`,
      { root, manifestPath },
    );
  }

  const manifest = createAgentPluginManifest(options);
  mkdirSync(root, { recursive: true });
  writeFileSync(manifestPath, serializeAgentPluginManifest(manifest), "utf8");
  return { root, manifestPath, manifest };
}
