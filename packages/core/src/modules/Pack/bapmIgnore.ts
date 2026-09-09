/**
 * Project-root `.bapmignore` — gitignore-compatible omit rules for pack / publish.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import ignore from "ignore";
import { PackError } from "./errors.ts";

export const BAPM_IGNORE_FILE = ".bapmignore";

/** Root dual-read manifests — never omit via ignore patterns. */
const ALWAYS_INCLUDE_ROOT = new Set(["bapm.yml", "apm.yml"]);

export type BapmIgnoreRules = {
  /** True when `relativePath` (project-root, `/` separators) should be omitted. */
  ignores(relativePath: string): boolean;
};

const EMPTY_RULES: BapmIgnoreRules = {
  ignores: () => false,
};

/**
 * Load project-root `.bapmignore`.
 * Missing file → empty rules (no-op). Unreadable / non-file → fail closed.
 */
export function loadBapmIgnore(cwd: string): BapmIgnoreRules {
  const root = resolve(cwd);
  const path = join(root, BAPM_IGNORE_FILE);

  if (!existsSync(path)) {
    return EMPTY_RULES;
  }

  let st;
  try {
    st = statSync(path);
  } catch (cause) {
    throw new PackError("PACK_IO", `Unreadable .bapmignore: ${path}`, { path, cause });
  }

  if (!st.isFile()) {
    throw new PackError(
      "PACK_VALIDATION",
      `.bapmignore must be a readable text file, not a directory: ${path}`,
      { path },
    );
  }

  let text: string;
  try {
    const buf = readFileSync(path);
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch (cause) {
    throw new PackError(
      "PACK_IO",
      `Failed to read .bapmignore as UTF-8 text (unreadable or malformed encoding): ${path}`,
      { path, cause },
    );
  }

  const ig = ignore().add(text);

  return {
    ignores(relativePath: string): boolean {
      const normalized = normalizeRel(relativePath);
      if (!normalized) return false;
      if (ALWAYS_INCLUDE_ROOT.has(normalized)) return false;
      try {
        return ig.ignores(normalized);
      } catch {
        // Relative-path validation edge cases — treat as not ignored.
        return false;
      }
    },
  };
}

export function isBapmIgnored(relativePath: string, rules: BapmIgnoreRules): boolean {
  return rules.ignores(relativePath);
}

/** Whether a directory path should be pruned from the walk. */
export function isBapmIgnoredDir(relativePath: string, rules: BapmIgnoreRules): boolean {
  const normalized = normalizeRel(relativePath);
  if (!normalized) return false;
  return rules.ignores(normalized) || rules.ignores(`${normalized}/`);
}

function normalizeRel(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}
