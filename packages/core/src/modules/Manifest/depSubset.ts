/**
 * Consumer-side `skills:` / `targets:` subset parse for object-form APM deps
 * (shared by registry `id:` and git-longhand `git:` — APM #2166 / req-mf-022).
 */
import { ManifestError } from "./errors.ts";
import { isValidTargetToken } from "./targets.ts";

/** Reject empty, traversal (`..`), and absolute/drive skill names. */
export function parseDepSkillSubset(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path}: "skills" must be a list/array of skill name strings`,
      { path },
    );
  }
  if (value.length === 0) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path}: "skills" must contain at least one skill name (non-empty list)`,
      { path },
    );
  }

  const names: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    const itemPath = `${path}[${i}]`;
    if (typeof item !== "string") {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${itemPath}: skills items must be strings`,
        { path: itemPath },
      );
    }
    const name = item.trim();
    if (!name) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${itemPath}: skill name must be a non-empty string`,
        { path: itemPath },
      );
    }
    assertSafeSkillName(name, itemPath);
    names.push(name);
  }

  return dedupeSort(names);
}

/** Reject empty lists and unknown mf-005 tokens. */
export function parseDepTargetSubset(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path}: "targets" must be a list/array of target tokens`,
      { path },
    );
  }
  if (value.length === 0) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path}: "targets" must contain at least one target name (non-empty list)`,
      { path },
    );
  }

  const tokens: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    const itemPath = `${path}[${i}]`;
    if (typeof item !== "string") {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${itemPath}: targets items must be strings`,
        { path: itemPath },
      );
    }
    const token = item.trim();
    if (!token) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${itemPath}: target token must be a non-empty string`,
        { path: itemPath },
      );
    }
    if (!isValidTargetToken(token)) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${itemPath}: unknown target token "${token}" (invalid target)`,
        { path: itemPath, details: { token } },
      );
    }
    tokens.push(token);
  }

  return dedupeSort(tokens);
}

/**
 * Apply subset validation onto an object-form entry when `skills` / `targets` are set.
 * Returns a shallow copy with typed string lists (or omits keys when absent).
 */
export function applyDepSubsetFields(
  obj: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };

  if ("skills" in obj && obj.skills !== undefined) {
    out.skills = parseDepSkillSubset(obj.skills, `${path}.skills`);
  } else {
    delete out.skills;
  }

  if ("targets" in obj && obj.targets !== undefined) {
    out.targets = parseDepTargetSubset(obj.targets, `${path}.targets`);
  } else {
    delete out.targets;
  }

  return out;
}

function assertSafeSkillName(name: string, path: string): void {
  const normalized = name.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.startsWith("~/")
  ) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path}: skill name must not be an absolute path ("${name}")`,
      { path, details: { skill: name } },
    );
  }
  const segments = normalized.split("/");
  if (segments.some((s) => s === ".." || s === ".")) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path}: skill name must not contain path traversal ("${name}")`,
      { path, details: { skill: name } },
    );
  }
}

function dedupeSort(items: string[]): string[] {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
}
