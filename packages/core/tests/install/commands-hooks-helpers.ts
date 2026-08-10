/**
 * Shared fixtures for command/hook discovery and host install suites.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import { createCursorIntegration } from "@b-apm/integration-cursor";
import { createOpencodeIntegration } from "@b-apm/integration-opencode";
import {
  createTempProject,
  getDiscoverPrimitives,
  getResolvePrimitiveConflicts,
  getRunInstall,
  nameOf,
  primitivesOf,
  sourceOf,
  typeOfPrimitive,
  writeText,
  type TempProject,
} from "./helpers.ts";
import { getRunUninstall } from "../lifecycle/helpers.ts";

export {
  createTempProject,
  getDiscoverPrimitives,
  getResolvePrimitiveConflicts,
  getRunInstall,
  getRunUninstall,
  nameOf,
  primitivesOf,
  sourceOf,
  typeOfPrimitive,
  writeText,
  type TempProject,
};

export const AGENT_PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

export function writeApmPackage(
  root: string,
  name: string,
  extras?: { prompts?: Record<string, string>; hooks?: Record<string, string> },
): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "apm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    "utf8",
  );
  for (const [stem, body] of Object.entries(extras?.prompts ?? {})) {
    writeText(join(root, ".apm", "prompts", `${stem}.prompt.md`), body);
  }
  for (const [stem, body] of Object.entries(extras?.hooks ?? {})) {
    writeText(join(root, ".apm", "hooks", `${stem}.json`), body);
  }
}

export function cursorCommandPrompt(name: string, extraFrontmatter = ""): string {
  return `---\ndescription: ${name} command\nallowed-tools: Read\nmodel: inherit\nargument-hint: "[path]"\ninput: prompt\n${extraFrontmatter}---\n# ${name}\nReview carefully.\n`;
}

/** Minimal Cursor-flat hook JSON referencing a package-relative script. */
export function cursorFlatHookJson(scriptRel: string): string {
  return `${JSON.stringify(
    {
      version: 1,
      hooks: {
        sessionStart: [{ command: scriptRel }],
      },
    },
    null,
    2,
  )}\n`;
}

export function reportDiagnostics(report: unknown): unknown[] {
  if (!report || typeof report !== "object") return [];
  const r = report as Record<string, unknown>;
  return Array.isArray(r.diagnostics) ? r.diagnostics : [];
}

export function deployedPaths(report: unknown): string[] {
  if (!report || typeof report !== "object") return [];
  const files = (report as { deployedFiles?: unknown }).deployedFiles;
  if (!Array.isArray(files)) return [];
  return files
    .map((f) =>
      f && typeof f === "object" && typeof (f as { path?: unknown }).path === "string"
        ? (f as { path: string }).path
        : "",
    )
    .filter(Boolean);
}

export function createCursorRegistry() {
  const registry = createIntegrationRegistry();
  registry.register(createCursorIntegration());
  return registry;
}

export function createOpencodeRegistry() {
  const registry = createIntegrationRegistry();
  registry.register(createOpencodeIntegration());
  return registry;
}

export function findByNameType(
  primitives: Record<string, unknown>[],
  name: string,
  type: string,
): Record<string, unknown> | undefined {
  return primitives.find(
    (p) => nameOf(p) === name && typeOfPrimitive(p).toLowerCase() === type.toLowerCase(),
  );
}
