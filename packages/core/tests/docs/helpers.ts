/**
 * Docs boundary — path helpers for README / VitePress presence checks.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(here, "../..");
export const repoRoot = resolve(coreRoot, "../..");

export const readmePath = join(repoRoot, "README.md");
export const docsRoot = join(repoRoot, "apps/docs");
export const conformanceGuidePath = join(docsRoot, "guide/conformance.md");
export const docsLandingPath = join(docsRoot, "index.md");
export const docsGuideIndexPath = join(docsRoot, "guide/index.md");
export const docsArchitecturePath = join(docsRoot, "architecture/index.md");
export const vitepressConfigPath = join(docsRoot, ".vitepress/config.ts");

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

/** Extract markdown body under `## <heading>` until the next `## ` heading. */
export function sectionUnderH2(markdown: string, heading: string): string | undefined {
  const needle = `## ${heading}`;
  const start = markdown.indexOf(needle);
  if (start < 0) return undefined;
  const after = markdown.slice(start + needle.length);
  const next = after.search(/\n## /);
  return next < 0 ? after : after.slice(0, next);
}
